import React, { useState, useMemo } from 'react';

// 데이터 타입 정의
interface RecordData {
  id: string;
  trader: string;
  type: 'buy' | 'sell';
  target_currency: string;
  foreign_amount: number;
  exchange_rate: number;
  base_amount: number;
}

interface HoldingsStatusProps {
  records: RecordData[];
  soldBuyIds: string[];
}

const HoldingsStatus: React.FC<HoldingsStatusProps> = ({ records, soldBuyIds }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTrader, setSelectedTrader] = useState<string>('SW'); // 기본값 SW

  // 선택된 거래자의 안 팔린(보유 중인) 매수 기록만 모아서 정렬
  const holdingsList = useMemo(() => {
    // 1. 매수 기록 중 안 팔린 기록만 필터링하고 선택된 거래자만 추출
    const unsoldBuys = records.filter(
      r => r.type === 'buy' && 
      r.trader === selectedTrader && 
      !soldBuyIds.includes(r.id.toString())
    );

    // 2. 정렬: 통화명(오름차순) -> 환율(오름차순: 낮은 환율이 위로)
    return unsoldBuys.sort((a, b) => {
      if (a.target_currency === b.target_currency) {
        return a.exchange_rate - b.exchange_rate;
      }
      return a.target_currency.localeCompare(b.target_currency);
    });
  }, [records, selectedTrader, soldBuyIds]);

  return (
    // 기존 환율 계산기의 스타일(calculator-section)을 그대로 활용하여 통일감 부여
    <section className="calculator-section" style={{ marginTop: '20px' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="accordion-toggle" 
        aria-expanded={isOpen}
      >
        📊 보유 현황 {isOpen ? <span>▲</span> : <span>▼</span>}
      </button>
      
      {isOpen && (
        <div id="calculator-content">
          <div className="form-group">
            <label>거래자</label>
            <div className="button-group">
                <button onClick={() => setSelectedTrader('SW')} className={`btn-trader ${selectedTrader === 'SW' ? 'active' : ''}`}>SW</button>
                <button onClick={() => setSelectedTrader('HR')} className={`btn-trader ${selectedTrader === 'HR' ? 'active' : ''}`}>HR</button>
            </div>
          </div>

          <div style={{ marginTop: '15px' }}>
            {holdingsList.length > 0 ? (
              <table style={{ width: '100%', textAlign: 'center', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ecf0f1', color: '#7f8c8d', fontSize: '14px' }}>
                    <th style={{ padding: '10px 5px' }}>통화</th>
                    <th style={{ padding: '10px 5px' }}>환율</th>
                    <th style={{ padding: '10px 5px' }}>원화금액</th>
                  </tr>
                </thead>
                <tbody>
                  {holdingsList.map(record => (
                    <tr key={record.id} style={{ borderBottom: '1px solid #f9f9f9', fontSize: '15px' }}>
                      <td style={{ padding: '12px 5px', fontWeight: 'bold', color: '#2c3e50' }}>{record.target_currency}</td>
                      <td style={{ padding: '12px 5px' }}>{Number(record.exchange_rate).toLocaleString()}</td>
                      <td style={{ padding: '12px 5px' }}>{Math.round(record.base_amount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ textAlign: 'center', color: '#95a5a6', padding: '30px 0' }}>현재 보유 중인 종목이 없습니다.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default HoldingsStatus;