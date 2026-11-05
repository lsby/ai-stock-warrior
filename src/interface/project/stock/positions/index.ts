import {
  JSON参数解析插件,
  常用接口返回器,
  接口,
  接口逻辑,
  计算接口逻辑JSON参数,
  计算接口逻辑正确结果,
  计算接口逻辑错误结果,
} from '@lsby/net-core'
import { Right } from '@lsby/ts-fp-data'
import { z } from 'zod'
import { kysely插件 } from '../../../../global/plugin'
import { 股票交易管理器 } from '../../../../model/stock/stock-broker'

let 接口路径 = '/api/project/stock/positions' as const
let 接口方法 = 'post' as const

let 接口逻辑实现 = 接口逻辑.空逻辑().绑定(
  接口逻辑.构造([new JSON参数解析插件(z.object({}).strict(), {}), kysely插件], async (参数) => {
    let 持仓组 = await 股票交易管理器.获得单例().获得持仓列表(参数.kysely.获得句柄())
    return new Right({ items: 持仓组 })
  }),
)

type _接口逻辑JSON参数 = 计算接口逻辑JSON参数<typeof 接口逻辑实现>
type _接口逻辑错误返回 = 计算接口逻辑错误结果<typeof 接口逻辑实现>
type _接口逻辑正确返回 = 计算接口逻辑正确结果<typeof 接口逻辑实现>

let 接口错误类型描述 = z.never()
let 接口正确类型描述 = z
  .object({
    items: z.array(
      z.object({
        symbol: z.string(),
        sec_name: z.string(),
        volume: z.number(),
        available_volume: z.number(),
        vwap: z.number(),
        price: z.number(),
        market_value: z.number(),
        floating_profit: z.number(),
        floating_profit_rate: z.number(),
      }),
    ),
  })
  .strip()

export default new 接口(接口路径, 接口方法, 接口逻辑实现, new 常用接口返回器(接口错误类型描述, 接口正确类型描述), {
  浏览器支持: '纯前端',
})

export let 查询持仓接口 = 接口逻辑实现.获得最后接口()
