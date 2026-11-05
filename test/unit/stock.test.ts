import { describe, expect, it } from 'vitest'
import { 股票行情管理器 } from '../../src/model/stock/stock-market'

describe('A股纯TS行情测试', () => {
  it('代码格式化与转换应当正确', () => {
    expect(股票行情管理器.规范化Symbol('600000')).toBe('SHSE.600000')
    expect(股票行情管理器.规范化Symbol('000001')).toBe('SZSE.000001')
    expect(股票行情管理器.转换至腾讯代码('SHSE.600000')).toBe('sh600000')
    expect(股票行情管理器.转换至腾讯代码('SZSE.000001')).toBe('sz000001')
  })

  it('应当能成功获取浦发银行实时报价', async () => {
    let 行情 = 股票行情管理器.获得单例()
    let 报价 = await 行情.获得实时报价('SHSE.600000')
    expect(报价.symbol).toBe('SHSE.600000')
    expect(报价.sec_name).toContain('浦发')
    expect(报价.price).toBeGreaterThan(0)
    expect(报价.open).toBeGreaterThan(0)
    expect(报价.high).toBeGreaterThan(0)
    expect(报价.low).toBeGreaterThan(0)
  })

  it('应当能成功获取历史K线数据', async () => {
    let 行情 = 股票行情管理器.获得单例()
    let klines = await 行情.获得历史K线({ symbol: 'SHSE.600000', countDays: 5 })
    expect(klines.length).toBeGreaterThan(0)
    let 最新K = klines[klines.length - 1]
    expect(最新K).toBeDefined()
    if (最新K !== undefined) {
      expect(最新K.symbol).toBe('SHSE.600000')
      expect(最新K.close).toBeGreaterThan(0)
    }
  })
})
