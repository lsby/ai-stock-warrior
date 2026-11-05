import {
  JSON参数解析插件,
  常用接口返回器,
  接口,
  接口逻辑,
  计算接口逻辑JSON参数,
  计算接口逻辑正确结果,
  计算接口逻辑错误结果,
} from '@lsby/net-core'
import { Left, Right } from '@lsby/ts-fp-data'
import { z } from 'zod'
import { kysely插件 } from '../../../../global/plugin'
import { 股票交易管理器 } from '../../../../model/stock/stock-broker'

let 接口路径 = '/api/project/stock/order-submit' as const
let 接口方法 = 'post' as const

let 接口逻辑实现 = 接口逻辑.空逻辑().绑定(
  接口逻辑.构造(
    [
      new JSON参数解析插件(
        z
          .object({
            symbol: z.string().min(1),
            side: z.enum(['buy', 'sell']),
            volume: z.number().int().positive(),
            order_type: z.enum(['limit', 'market']).default('limit'),
            price: z.number().positive().optional(),
            confirm: z.boolean(),
          })
          .strict(),
        {},
      ),
      kysely插件,
    ],
    async (参数) => {
      try {
        let 结果 = await 股票交易管理器
          .获得单例()
          .提交委托(参数.kysely.获得句柄(), {
            symbol: 参数.json.symbol,
            side: 参数.json.side,
            volume: 参数.json.volume,
            order_type: 参数.json.order_type,
            price: 参数.json.price,
            confirm: 参数.json.confirm,
          })
        return new Right({ order: 结果 })
      } catch (错误) {
        let 消息 = 错误 instanceof Error ? 错误.message : '委托提交失败'
        return new Left(消息 as '委托提交失败')
      }
    },
  ),
)

type _接口逻辑JSON参数 = 计算接口逻辑JSON参数<typeof 接口逻辑实现>
type _接口逻辑错误返回 = 计算接口逻辑错误结果<typeof 接口逻辑实现>
type _接口逻辑正确返回 = 计算接口逻辑正确结果<typeof 接口逻辑实现>

let 接口错误类型描述 = z.string()
let 接口正确类型描述 = z
  .object({
    order: z.object({
      cl_ord_id: z.string(),
      symbol: z.string(),
      sec_name: z.string(),
      side: z.string(),
      order_type: z.string(),
      price: z.number(),
      volume: z.number(),
      filled_volume: z.number(),
      filled_vwap: z.number(),
      status: z.string(),
      reject_reason: z.string().nullable(),
      created_at: z.string(),
    }),
  })
  .strip()

export default new 接口(接口路径, 接口方法, 接口逻辑实现, new 常用接口返回器(接口错误类型描述, 接口正确类型描述), {
  浏览器支持: '纯前端',
})

export let 提交委托接口 = 接口逻辑实现.获得最后接口()
