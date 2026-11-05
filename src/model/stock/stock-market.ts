export type 标的交易所 = 'SHSE' | 'SZSE'

export type 标的简要信息 = { symbol: string; sec_name: string; exchange: 标的交易所 }

export type 实时报价 = {
  symbol: string
  sec_name: string
  price: number
  open: number
  high: number
  low: number
  cum_volume: number
  cum_amount: number
  created_at: string
}

export type K线数据项 = {
  symbol: string
  eob: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  amount: number
}

export class 股票行情管理器 {
  private static 单例 = new 股票行情管理器()

  public static 获得单例(): 股票行情管理器 {
    return this.单例
  }

  /**
   * 将系统内部 symbol（如 SHSE.600000）转换为腾讯代码（sh600000）
   */
  public static 转换至腾讯代码(symbol: string): string {
    let 纯大写 = symbol.trim().toUpperCase()
    if (纯大写.startsWith('SHSE.')) {
      return `sh${纯大写.slice(5)}`
    }
    if (纯大写.startsWith('SZSE.')) {
      return `sz${纯大写.slice(5)}`
    }
    if (纯大写.startsWith('SH') || 纯大写.startsWith('SZ')) {
      return 纯大写.toLowerCase()
    }
    // 默认根据代码前缀猜测
    if (纯大写.startsWith('6')) {
      return `sh${纯大写}`
    }
    return `sz${纯大写}`
  }
  /**
   * 将系统内部 symbol 转换为东财 secid (1.600000 或 0.000001)
   */
  public static 转换至东财Secid(symbol: string): string {
    let 纯大写 = symbol.trim().toUpperCase()
    if (纯大写.startsWith('SHSE.')) {
      return `1.${纯大写.slice(5)}`
    }
    if (纯大写.startsWith('SZSE.')) {
      return `0.${纯大写.slice(5)}`
    }
    if (纯大写.startsWith('6')) {
      return `1.${纯大写}`
    }
    return `0.${纯大写}`
  }
  /**
   * 将输入代码格式化为标准 SHSE.600000 或 SZSE.000001
   */
  public static 规范化Symbol(symbol: string): string {
    let 纯大写 = symbol.trim().toUpperCase()
    if (纯大写.startsWith('SHSE.') || 纯大写.startsWith('SZSE.')) {
      return 纯大写
    }
    if (纯大写.startsWith('SH')) {
      return `SHSE.${纯大写.slice(2)}`
    }
    if (纯大写.startsWith('SZ')) {
      return `SZSE.${纯大写.slice(2)}`
    }
    if (纯大写.startsWith('6')) {
      return `SHSE.${纯大写}`
    }
    return `SZSE.${纯大写}`
  }
  private 缓存标的列表: 标的简要信息[] = []
  private 上次获取标的时间: number = 0

  private constructor() {}

  /**
   * 获取并缓存全量 A 股列表
   */
  public async 获得标的列表(): Promise<标的简要信息[]> {
    let 当前时间 = Date.now()
    // 缓存 1 小时
    if (this.缓存标的列表.length > 0 && 当前时间 - this.上次获取标的时间 < 3600 * 1000) {
      return this.缓存标的列表
    }

    try {
      let 接口地址 =
        'https://82.push2.eastmoney.com/api/qt/clist/get?pn=1&pz=6000&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f12,f14,f13'
      let 响应 = await fetch(接口地址, { signal: AbortSignal.timeout(10000) })
      if (响应.ok === false) {
        throw new Error(`获取标的列表失败: HTTP ${响应.status}`)
      }
      let 数据 = (await 响应.json()) as { data?: { diff?: Array<{ f12?: string; f13?: number; f14?: string }> } }

      let 条目组 = 数据.data?.diff ?? []
      let 结果组: 标的简要信息[] = []
      for (let 索引 = 0; 索引 < 条目组.length; 索引 += 1) {
        let 条目 = 条目组[索引]
        if (条目 === undefined) continue
        let 代码 = 条目.f12
        let 名称 = 条目.f14
        let 市场标识 = 条目.f13
        if (代码 === undefined || 名称 === undefined || 市场标识 === undefined) continue

        let 交易所: 标的交易所 = 市场标识 === 1 ? 'SHSE' : 'SZSE'
        结果组.push({ symbol: `${交易所}.${代码}`, sec_name: 名称, exchange: 交易所 })
      }

      if (结果组.length > 0) {
        this.缓存标的列表 = 结果组
        this.上次获取标的时间 = 当前时间
        return 结果组
      }
    } catch {
      // 容错: 若网络临时失败且有旧缓存，返回旧缓存
      if (this.缓存标的列表.length > 0) {
        return this.缓存标的列表
      }
    }

    // 若首次网络请求异常，返回常见核心标的作为保底数据
    let 兜底标的组: 标的简要信息[] = [
      { symbol: 'SHSE.600000', sec_name: '浦发银行', exchange: 'SHSE' },
      { symbol: 'SHSE.600519', sec_name: '贵州茅台', exchange: 'SHSE' },
      { symbol: 'SZSE.000001', sec_name: '平安银行', exchange: 'SZSE' },
      { symbol: 'SZSE.000858', sec_name: '五粮液', exchange: 'SZSE' },
      { symbol: 'SZSE.300750', sec_name: '宁德时代', exchange: 'SZSE' },
    ]
    return 兜底标的组
  }

  /**
   * 获取实时行情报价 (通过腾讯财经接口，极速毫秒级)
   */
  public async 获得实时报价(symbol: string): Promise<实时报价> {
    let 标准代码 = 股票行情管理器.规范化Symbol(symbol)
    let 腾讯代码 = 股票行情管理器.转换至腾讯代码(标准代码)
    let 接口地址 = `https://qt.gtimg.cn/q=${腾讯代码}`

    let 响应 = await fetch(接口地址, { signal: AbortSignal.timeout(5000) })
    if (响应.ok === false) {
      throw new Error(`获取报价失败: HTTP ${响应.status}`)
    }

    let 二进制数据 = await 响应.arrayBuffer()
    let 解码器 = new TextDecoder('gbk')
    let 文本 = 解码器.decode(二进制数据)

    let 等号位置 = 文本.indexOf('=')
    if (等号位置 === -1) {
      throw new Error(`报价响应格式错误: ${文本}`)
    }

    let 引号内容 = 文本.slice(等号位置 + 1).trim()
    if (引号内容.startsWith('"') && 引号内容.endsWith('";')) {
      引号内容 = 引号内容.slice(1, -2)
    }

    let 字段列表 = 引号内容.split('~')
    let 名称 = 字段列表[1]
    let 当前价格文本 = 字段列表[3]
    let 昨收文本 = 字段列表[4]
    let 今开文本 = 字段列表[5]
    let 成交量手文本 = 字段列表[6]
    let 最高文本 = 字段列表[33]
    let 最低文本 = 字段列表[34]
    let 成交额万文本 = 字段列表[37]
    let 时间文本 = 字段列表[30]

    if (
      名称 === undefined ||
      当前价格文本 === undefined ||
      昨收文本 === undefined ||
      今开文本 === undefined ||
      最高文本 === undefined ||
      最低文本 === undefined
    ) {
      throw new Error(`未能获取到 ${symbol} 的有效行情数据`)
    }

    let 当前价格 = parseFloat(当前价格文本)
    let 昨收 = parseFloat(昨收文本)
    let 今开 = parseFloat(今开文本)
    let 最高 = parseFloat(最高文本)
    let 最低 = parseFloat(最低文本)
    let 成交量手 = parseFloat(成交量手文本 ?? '0')
    let 成交额万 = parseFloat(成交额万文本 ?? '0')

    // 未开盘或停牌现价为 0 时，取昨收或今开
    let 有效价格 = 当前价格 > 0 ? 当前价格 : 今开 > 0 ? 今开 : 昨收

    let 格式化时间 = 时间文本 ?? new Date().toISOString()
    if (格式化时间.length === 14) {
      let 年 = 格式化时间.slice(0, 4)
      let 月 = 格式化时间.slice(4, 6)
      let 日 = 格式化时间.slice(6, 8)
      let 时 = 格式化时间.slice(8, 10)
      let 分 = 格式化时间.slice(10, 12)
      let 秒 = 格式化时间.slice(12, 14)
      格式化时间 = `${年}-${月}-${日} ${时}:${分}:${秒}`
    }

    return {
      symbol: 标准代码,
      sec_name: 名称,
      price: 有效价格,
      open: 今开,
      high: 最高 > 0 ? 最高 : 有效价格,
      low: 最低 > 0 ? 最低 : 有效价格,
      cum_volume: 成交量手 * 100, // 转换为股数
      cum_amount: 成交额万 * 10000, // 转换为元
      created_at: 格式化时间,
    }
  }

  /**
   * 获取历史 K 线数据 (通过东方财富接口，默认日K)
   */
  public async 获得历史K线(参数: {
    symbol: string
    countDays?: number | undefined
    frequency?: string | undefined
    startTime?: string | undefined
    endTime?: string | undefined
  }): Promise<K线数据项[]> {
    let 标准代码 = 股票行情管理器.规范化Symbol(参数.symbol)
    let secid = 股票行情管理器.转换至东财Secid(标准代码)
    let 数量 = 参数.countDays ?? 30

    let 接口地址 = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=1&end=20500101&lmt=${数量}`
    let 响应 = await fetch(接口地址, { signal: AbortSignal.timeout(8000) })
    if (响应.ok === false) {
      throw new Error(`获取K线失败: HTTP ${响应.status}`)
    }

    let 数据 = (await 响应.json()) as { data?: { klines?: string[] } }

    let klines = 数据.data?.klines ?? []
    let 结果组: K线数据项[] = []

    for (let 索引 = 0; 索引 < klines.length; 索引 += 1) {
      let 单条 = klines[索引]
      if (单条 === undefined) continue
      let 字段列表 = 单条.split(',')
      let 日期 = 字段列表[0]
      let 开盘 = 字段列表[1]
      let 收盘 = 字段列表[2]
      let 最高 = 字段列表[3]
      let 最低 = 字段列表[4]
      let 成交量 = 字段列表[5]
      let 成交额 = 字段列表[6]

      if (
        日期 === undefined ||
        开盘 === undefined ||
        收盘 === undefined ||
        最高 === undefined ||
        最低 === undefined ||
        成交量 === undefined ||
        成交额 === undefined
      ) {
        continue
      }

      // 时间范围过滤
      if (参数.startTime !== undefined && 日期 < 参数.startTime) continue
      if (参数.endTime !== undefined && 日期 > 参数.endTime) continue

      结果组.push({
        symbol: 标准代码,
        eob: `${日期} 15:00:00`,
        open: parseFloat(开盘),
        close: parseFloat(收盘),
        high: parseFloat(最高),
        low: parseFloat(最低),
        volume: parseFloat(成交量),
        amount: parseFloat(成交额),
      })
    }

    return 结果组
  }
}
