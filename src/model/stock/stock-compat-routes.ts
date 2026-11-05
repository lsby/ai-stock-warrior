import {
  JSON参数解析插件,
  Query参数解析插件,
  接口,
  接口逻辑,
  自定义接口返回器,
  路径解析插件,
  type 任意接口,
} from '@lsby/net-core'
import { Left, Right } from '@lsby/ts-fp-data'
import { z } from 'zod'
import { kysely插件 } from '../../global/plugin'
import { 股票交易管理器 } from './stock-broker'
import { 股票行情管理器 } from './stock-market'

function 创建原始JSON返回器<T extends z.ZodTypeAny>(
  正确类型: T,
): 自定义接口返回器<z.ZodString, T, z.ZodObject<{ detail: z.ZodString }, 'strip'>, T> {
  return new 自定义接口返回器(
    z.string(),
    正确类型,
    z.object({ detail: z.string() }).strip(),
    正确类型,
    (req, res, 数据) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      数据.match(
        (错误: string) => {
          res.statusCode = 400
          res.end(JSON.stringify({ detail: 错误 }))
        },
        (成功: unknown) => {
          res.statusCode = 200
          res.end(JSON.stringify(成功))
        },
      )
    },
  )
}

let 兼容健康检查接口 = new 接口(
  '/health',
  'get',
  接口逻辑.空逻辑().绑定(
    接口逻辑.构造([kysely插件], async (参数) => {
      let 资产 = await 股票交易管理器.获得单例().获得账户资产(参数.kysely.获得句柄())
      return new Right({ status: 'ok', endpoint: 'local-ts', account_suffix: '000001', nav: 资产.nav })
    }),
  ),
  创建原始JSON返回器(z.record(z.string(), z.any())),
)

let 兼容资金接口 = new 接口(
  '/account',
  'get',
  接口逻辑.空逻辑().绑定(
    接口逻辑.构造([kysely插件], async (参数) => {
      let 资产 = await 股票交易管理器.获得单例().获得账户资产(参数.kysely.获得句柄())
      return new Right(资产)
    }),
  ),
  创建原始JSON返回器(z.record(z.string(), z.any())),
)

let 兼容持仓接口 = new 接口(
  '/positions',
  'get',
  接口逻辑.空逻辑().绑定(
    接口逻辑.构造([kysely插件], async (参数) => {
      let 持仓组 = await 股票交易管理器.获得单例().获得持仓列表(参数.kysely.获得句柄())
      return new Right(持仓组)
    }),
  ),
  创建原始JSON返回器(z.array(z.any())),
)

let 兼容委托列表接口 = new 接口(
  '/orders',
  'get',
  接口逻辑.空逻辑().绑定(
    接口逻辑.构造(
      [new Query参数解析插件(z.object({ unfinished_only: z.string().optional() })), kysely插件],
      async (参数) => {
        let 仅看未完成 = 参数.query.unfinished_only === 'true'
        let 列表 = await 股票交易管理器.获得单例().获得委托列表(参数.kysely.获得句柄(), 仅看未完成)
        return new Right(列表)
      },
    ),
  ),
  创建原始JSON返回器(z.array(z.any())),
)

let 兼容标的列表接口 = new 接口(
  '/instruments',
  'get',
  接口逻辑.空逻辑().绑定(
    接口逻辑.构造(
      [
        new Query参数解析插件(
          z.object({
            exchange: z.enum(['SHSE', 'SZSE']).optional(),
            search: z.string().optional(),
            limit: z.string().optional(),
            offset: z.string().optional(),
          }),
        ),
      ],
      async (参数) => {
        let 全量 = await 股票行情管理器.获得单例().获得标的列表()
        let 过滤 = 全量

        if (参数.query.exchange !== undefined) {
          过滤 = 过滤.filter((item) => item.exchange === 参数.query.exchange)
        }

        if (参数.query.search !== undefined && 参数.query.search.trim() !== '') {
          let 词 = 参数.query.search.trim().toLowerCase()
          过滤 = 过滤.filter(
            (item) => item.symbol.toLowerCase().includes(词) || item.sec_name.toLowerCase().includes(词),
          )
        }

        let 起始 = parseInt(参数.query.offset ?? '0', 10)
        let 数量 = parseInt(参数.query.limit ?? '100', 10)
        if (Number.isNaN(起始)) 起始 = 0
        if (Number.isNaN(数量)) 数量 = 100

        return new Right({ total: 过滤.length, offset: 起始, limit: 数量, items: 过滤.slice(起始, 起始 + 数量) })
      },
    ),
  ),
  创建原始JSON返回器(z.record(z.string(), z.any())),
)

let 兼容实时报价接口 = new 接口(
  new RegExp('^/quotes/.*$'),
  'get',
  接口逻辑.空逻辑().绑定(
    接口逻辑.构造([new 路径解析插件()], async (参数) => {
      let 标的 = 参数.path.rawPath.replace(/^\/quotes\//, '').trim()
      if (标的 === '') {
        return new Left('缺少标的代码')
      }
      try {
        let 报价 = await 股票行情管理器.获得单例().获得实时报价(标的)
        return new Right(报价)
      } catch (错误) {
        let 消息 = 错误 instanceof Error ? 错误.message : '获取报价失败'
        return new Left(消息)
      }
    }),
  ),
  创建原始JSON返回器(z.record(z.string(), z.any())),
)

let 兼容历史K线接口 = new 接口(
  new RegExp('^/bars/.*$'),
  'get',
  接口逻辑.空逻辑().绑定(
    接口逻辑.构造(
      [
        new 路径解析插件(),
        new Query参数解析插件(
          z.object({
            count_days: z.string().optional(),
            frequency: z.string().optional(),
            start_time: z.string().optional(),
            end_time: z.string().optional(),
          }),
        ),
      ],
      async (参数) => {
        let 标的 = 参数.path.rawPath.replace(/^\/bars\//, '').trim()
        if (标的 === '') {
          return new Left('缺少标的代码')
        }
        let 天数 = parseInt(参数.query.count_days ?? '30', 10)
        if (Number.isNaN(天数)) 天数 = 30
        try {
          let klines = await 股票行情管理器
            .获得单例()
            .获得历史K线({
              symbol: 标的,
              countDays: 天数,
              frequency: 参数.query.frequency ?? '1d',
              startTime: 参数.query.start_time,
              endTime: 参数.query.end_time,
            })
          return new Right(klines)
        } catch (错误) {
          let 消息 = 错误 instanceof Error ? 错误.message : '获取K线失败'
          return new Left(消息)
        }
      },
    ),
  ),
  创建原始JSON返回器(z.array(z.any())),
)

let 兼容下单接口 = new 接口(
  '/trade/order',
  'post',
  接口逻辑.空逻辑().绑定(
    接口逻辑.构造(
      [
        new JSON参数解析插件(
          z.object({
            symbol: z.string(),
            side: z.enum(['buy', 'sell']),
            volume: z.number().int().positive(),
            order_type: z.enum(['limit', 'market']).default('limit'),
            price: z.number().optional(),
            confirm: z.boolean(),
          }),
          {},
        ),
        kysely插件,
      ],
      async (参数) => {
        try {
          let 订单 = await 股票交易管理器
            .获得单例()
            .提交委托(参数.kysely.获得句柄(), {
              symbol: 参数.json.symbol,
              side: 参数.json.side,
              volume: 参数.json.volume,
              order_type: 参数.json.order_type,
              price: 参数.json.price,
              confirm: 参数.json.confirm,
            })
          return new Right([订单])
        } catch (错误) {
          let 消息 = 错误 instanceof Error ? 错误.message : '下单失败'
          return new Left(消息)
        }
      },
    ),
  ),
  创建原始JSON返回器(z.array(z.any())),
)

let 兼容撤单接口 = new 接口(
  new RegExp('^/trade/cancel/.*$'),
  'post',
  接口逻辑.空逻辑().绑定(
    接口逻辑.构造(
      [new 路径解析插件(), new JSON参数解析插件(z.object({ confirm: z.boolean() }), {}), kysely插件],
      async (参数) => {
        let 订单编号 = 参数.path.rawPath.replace(/^\/trade\/cancel\//, '').trim()
        if (订单编号 === '') {
          return new Left('缺少订单编号')
        }
        try {
          let 撤销结果 = await 股票交易管理器
            .获得单例()
            .撤销委托(参数.kysely.获得句柄(), { cl_ord_id: 订单编号, confirm: 参数.json.confirm })
          return new Right([撤销结果])
        } catch (错误) {
          let 消息 = 错误 instanceof Error ? 错误.message : '撤单失败'
          return new Left(消息)
        }
      },
    ),
  ),
  创建原始JSON返回器(z.array(z.any())),
)

export let 股票兼容接口们: 任意接口[] = [
  兼容健康检查接口,
  兼容资金接口,
  兼容持仓接口,
  兼容委托列表接口,
  兼容标的列表接口,
  兼容实时报价接口,
  兼容历史K线接口,
  兼容下单接口,
  兼容撤单接口,
]
