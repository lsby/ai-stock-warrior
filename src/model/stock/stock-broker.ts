import type { Kysely } from 'kysely'
import type { DB } from '../../types/db'
import { 股票行情管理器 } from './stock-market'

export type 账户资产概况 = {
  cash: number
  available_cash: number
  frozen_cash: number
  market_value: number
  nav: number
}

export type 持仓详情 = {
  symbol: string
  sec_name: string
  volume: number
  available_volume: number
  vwap: number
  price: number
  market_value: number
  floating_profit: number
  floating_profit_rate: number
}

export type 下单参数 = {
  symbol: string
  side: 'buy' | 'sell'
  volume: number
  order_type: 'limit' | 'market'
  price?: number | undefined
  confirm: boolean
}

export type 委托订单详情 = {
  cl_ord_id: string
  symbol: string
  sec_name: string
  side: string
  order_type: string
  price: number
  volume: number
  filled_volume: number
  filled_vwap: number
  status: string
  reject_reason: string | null
  created_at: string
}

export class 股票交易管理器 {
  private static 单例 = new 股票交易管理器()

  public static 获得单例(): 股票交易管理器 {
    return this.单例
  }

  private constructor() {}

  /**
   * 确保默认账户存在
   */
  public async 确保账户初始化(db: Kysely<DB>): Promise<{ cash: number; frozen_cash: number }> {
    let 现有账户 = await db
      .selectFrom('trade_account')
      .selectAll()
      .where('id', '=', 'DEFAULT_ACCOUNT')
      .executeTakeFirst()
    if (现有账户 !== undefined) {
      return { cash: 现有账户.cash, frozen_cash: 现有账户.frozen_cash }
    }

    let 初始资金 = 100000.0
    await db
      .insertInto('trade_account')
      .values({ id: 'DEFAULT_ACCOUNT', cash: 初始资金, frozen_cash: 0, initial_cash: 初始资金 })
      .executeTakeFirst()

    return { cash: 初始资金, frozen_cash: 0 }
  }

  /**
   * 查询账户净资产及现金
   */
  public async 获得账户资产(db: Kysely<DB>): Promise<账户资产概况> {
    let 账户 = await this.确保账户初始化(db)
    let 持仓列表 = await this.获得持仓列表(db)

    let 总持仓市值 = 0
    for (let 索引 = 0; 索引 < 持仓列表.length; 索引 += 1) {
      let 持仓 = 持仓列表[索引]
      if (持仓 !== undefined) {
        总持仓市值 += 持仓.market_value
      }
    }

    let nav = 账户.cash + 账户.frozen_cash + 总持仓市值
    return {
      cash: 账户.cash,
      available_cash: 账户.cash,
      frozen_cash: 账户.frozen_cash,
      market_value: 总持仓市值,
      nav: parseFloat(nav.toFixed(2)),
    }
  }

  /**
   * 查询所有持仓并结合最新行情计算盈亏
   */
  public async 获得持仓列表(db: Kysely<DB>): Promise<持仓详情[]> {
    let 行情 = 股票行情管理器.获得单例()
    let 持仓记录组 = await db.selectFrom('trade_position').selectAll().execute()

    let 结果组: 持仓详情[] = []
    for (let 索引 = 0; 索引 < 持仓记录组.length; 索引 += 1) {
      let 记录 = 持仓记录组[索引]
      if (记录 === undefined) continue

      let 最新价 = 记录.vwap
      try {
        let 实时报价 = await 行情.获得实时报价(记录.symbol)
        最新价 = 实时报价.price
      } catch {
        // 如果拉取最新价失败，降级使用成本价
        最新价 = 记录.vwap
      }

      let 市值 = parseFloat((记录.volume * 最新价).toFixed(2))
      let 成本 = 记录.volume * 记录.vwap
      let 浮动盈亏 = parseFloat((市值 - 成本).toFixed(2))
      let 盈亏率 = 成本 > 0 ? parseFloat((浮动盈亏 / 成本).toFixed(4)) : 0

      结果组.push({
        symbol: 记录.symbol,
        sec_name: 记录.sec_name,
        volume: 记录.volume,
        available_volume: 记录.available_volume,
        vwap: 记录.vwap,
        price: 最新价,
        market_value: 市值,
        floating_profit: 浮动盈亏,
        floating_profit_rate: 盈亏率,
      })
    }

    return 结果组
  }

  /**
   * 查询当日委托
   */
  public async 获得委托列表(db: Kysely<DB>, 未完成过滤?: boolean): Promise<委托订单详情[]> {
    let 查询 = db.selectFrom('trade_order').selectAll().orderBy('created_at', 'desc')
    if (未完成过滤 === true) {
      查询 = 查询.where('status', '=', 'submitted')
    }
    let 订单组 = await 查询.execute()

    return 订单组.map((item) => ({
      cl_ord_id: item.id,
      symbol: item.symbol,
      sec_name: item.sec_name,
      side: item.side,
      order_type: item.order_type,
      price: item.price,
      volume: item.volume,
      filled_volume: item.filled_volume,
      filled_vwap: item.filled_vwap,
      status: item.status,
      reject_reason: item.reject_reason,
      created_at: item.created_at,
    }))
  }

  /**
   * 提交仿真委托
   */
  public async 提交委托(db: Kysely<DB>, 参数: 下单参数): Promise<委托订单详情> {
    if (参数.confirm !== true) {
      throw new Error('下单必须明确确认 (confirm: true)')
    }
    if (参数.volume <= 0) {
      throw new Error('委托数量必须大于 0')
    }
    if (参数.side === 'buy' && 参数.volume % 100 !== 0) {
      throw new Error('A 股买入数量必须是 100 的整数倍')
    }

    let 标准代码 = 股票行情管理器.规范化Symbol(参数.symbol)
    let 行情 = 股票行情管理器.获得单例()
    let 实时 = await 行情.获得实时报价(标准代码)

    let 成交价格 = 参数.price !== undefined && 参数.price > 0 ? 参数.price : 实时.price
    let 估算金额 = 成交价格 * 参数.volume

    // 单笔金额限制 20,000 元（与原项目策略保持一致）
    let 单笔限额 = 20000.0
    if (估算金额 > 单笔限额) {
      throw new Error(`单笔估算金额 ${估算金额.toFixed(2)} 超过风控上限 ${单笔限额.toFixed(2)}`)
    }

    let 账户 = await this.确保账户初始化(db)
    let 订单编号 = crypto.randomUUID().replace(/-/g, '')

    if (参数.side === 'buy') {
      let 所需资金 = 估算金额
      if (账户.cash < 所需资金) {
        throw new Error(`可用资金不足: 需要 ${所需资金.toFixed(2)}, 当前可用 ${账户.cash.toFixed(2)}`)
      }

      // 扣除现金
      await db
        .updateTable('trade_account')
        .set({ cash: parseFloat((账户.cash - 所需资金).toFixed(2)) })
        .where('id', '=', 'DEFAULT_ACCOUNT')
        .executeTakeFirst()

      // 更新持仓
      let 现有持仓 = await db.selectFrom('trade_position').selectAll().where('symbol', '=', 标准代码).executeTakeFirst()

      if (现有持仓 !== undefined) {
        let 旧总股数 = 现有持仓.volume
        let 新总股数 = 旧总股数 + 参数.volume
        let 新均价 = parseFloat(((现有持仓.vwap * 旧总股数 + 成交价格 * 参数.volume) / 新总股数).toFixed(3))
        await db
          .updateTable('trade_position')
          .set({ volume: 新总股数, available_volume: 现有持仓.available_volume + 参数.volume, vwap: 新均价 })
          .where('symbol', '=', 标准代码)
          .executeTakeFirst()
      } else {
        await db
          .insertInto('trade_position')
          .values({
            id: crypto.randomUUID(),
            symbol: 标准代码,
            sec_name: 实时.sec_name,
            volume: 参数.volume,
            available_volume: 参数.volume,
            vwap: 成交价格,
          })
          .executeTakeFirst()
      }
    } else {
      // 卖出逻辑
      let 现有持仓 = await db.selectFrom('trade_position').selectAll().where('symbol', '=', 标准代码).executeTakeFirst()

      if (现有持仓 === undefined || 现有持仓.available_volume < 参数.volume) {
        let 可用 = 现有持仓?.available_volume ?? 0
        throw new Error(`可用持仓不足: 需卖出 ${参数.volume}, 当前可用 ${可用}`)
      }

      // 增加现金
      let 获得资金 = 估算金额
      await db
        .updateTable('trade_account')
        .set({ cash: parseFloat((账户.cash + 获得资金).toFixed(2)) })
        .where('id', '=', 'DEFAULT_ACCOUNT')
        .executeTakeFirst()

      // 更新持仓
      let 剩余股数 = 现有持仓.volume - 参数.volume
      let 剩余可用 = 现有持仓.available_volume - 参数.volume

      if (剩余股数 <= 0) {
        await db.deleteFrom('trade_position').where('symbol', '=', 标准代码).executeTakeFirst()
      } else {
        await db
          .updateTable('trade_position')
          .set({ volume: 剩余股数, available_volume: 剩余可用 })
          .where('symbol', '=', 标准代码)
          .executeTakeFirst()
      }
    }

    // 记录订单完成
    let 订单记录: 委托订单详情 = {
      cl_ord_id: 订单编号,
      symbol: 标准代码,
      sec_name: 实时.sec_name,
      side: 参数.side,
      order_type: 参数.order_type,
      price: 成交价格,
      volume: 参数.volume,
      filled_volume: 参数.volume,
      filled_vwap: 成交价格,
      status: 'filled',
      reject_reason: null,
      created_at: new Date().toISOString(),
    }

    await db
      .insertInto('trade_order')
      .values({
        id: 订单编号,
        symbol: 标准代码,
        sec_name: 实时.sec_name,
        side: 参数.side,
        order_type: 参数.order_type,
        price: 成交价格,
        volume: 参数.volume,
        filled_volume: 参数.volume,
        filled_vwap: 成交价格,
        status: 'filled',
        reject_reason: null,
      })
      .executeTakeFirst()

    return 订单记录
  }

  /**
   * 撤销委托
   */
  public async 撤销委托(db: Kysely<DB>, 参数: { cl_ord_id: string; confirm: boolean }): Promise<委托订单详情> {
    if (参数.confirm !== true) {
      throw new Error('撤单必须明确确认 (confirm: true)')
    }

    let 订单 = await db.selectFrom('trade_order').selectAll().where('id', '=', 参数.cl_ord_id).executeTakeFirst()

    if (订单 === undefined) {
      throw new Error(`未找到指定订单: ${参数.cl_ord_id}`)
    }

    if (订单.status !== 'submitted') {
      throw new Error(`订单当前状态为 ${订单.status}，不可撤销`)
    }

    await db.updateTable('trade_order').set({ status: 'canceled' }).where('id', '=', 参数.cl_ord_id).executeTakeFirst()

    return {
      cl_ord_id: 订单.id,
      symbol: 订单.symbol,
      sec_name: 订单.sec_name,
      side: 订单.side,
      order_type: 订单.order_type,
      price: 订单.price,
      volume: 订单.volume,
      filled_volume: 订单.filled_volume,
      filled_vwap: 订单.filled_vwap,
      status: 'canceled',
      reject_reason: null,
      created_at: 订单.created_at,
    }
  }
}
