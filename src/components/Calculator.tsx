import React, { useState, useMemo } from 'react';

interface RecordData {
  id: string;
  trader: string;
  type: 'buy' | 'sell';
  timestamp: string;
  target_currency: string;
  foreign_amount: number;
  exchange_rate: number;
}

interface CalculatorProps {
  records: RecordData[];
  soldBuyIds: string[];
}

const Calculator: React.FC<CalculatorProps> = ({ records, soldBuyIds }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTrader, setSelectedTrader] = useState<string>('SW');
  const [selectedBuyId, setSelectedBuyId] = useState<string>('');

  const availableBuyRecords = useMemo(() => {
    return records.filter(
      r => r.type === 'buy' && 
      r.trader === selectedTrader && 
      !soldBuyIds.includes(r.id.toString())
    );
  }, [records, selectedTrader, soldBuyIds]);

  const scenarios = useMemo(() => {
    if (!selectedBuyId) return null;
    const record = records.find(r => r.id.toString() === selectedBuyId);
    if (!record) return null;

    const baseRate = record.exchange_rate;
    const amount = record.foreign_amount;
    const isJpy = record.target_currency === 'JPY';
    
    const result = [];
    let maxAbsPL = 0;

    for (let i = -5; i <= 5; i++) {
        if (i === 0) continue;
        const sellRate = baseRate + i;
        const buyCost = amount * (isJpy ? baseRate / 100 : baseRate);
        const sellRevenue = amount * (isJpy ? sellRate / 100 : sellRate);
        const profit = sellRevenue - buyCost;
        if (Math.abs(profit) > maxAbsPL) maxAbsPL = Math.abs(profit);
        result.push({ rate: sellRate, pl: profit });
    }
    return { data: result, maxAbsPL };
  }, [selectedBuyId, records]);

  return (
    <section className="calculator-section">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="accordion-toggle" 
        aria-expanded={isOpen}
      >
        환율 계산기 {isOpen ? <span>▲</span> : <span>▼</span>}
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
          
          <div className="form-group">
            <select 
                value={selectedBuyId} 
                onChange={(e) => setSelectedBuyId(e.target.value)}
                style={{ width: '100%', padding: '10px' }}
            >
              <option value="">-- 분석할 매수 건 선택 --</option>
              {availableBuyRecords.map(r => (
                <option key={r.id} value={r.id}>
                  {r.timestamp.substring(0, 10)} / {r.target_currency} {r.foreign_amount.toLocaleString()} (환율: {r.exchange_rate})
                </option>
              ))}
            </select>
          </div>

          {scenarios && (
            <div className="calculator-row" style={{ display: 'flex', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                <h4>수익 시나리오 (+1 ~ +5)</h4>
                {scenarios.data.filter(d => d.pl > 0).map(d => (
                    <div key={d.rate} className="h-bar-row">
                        <span className="h-bar-label">{d.rate}</span>
                        <div className="h-bar-container">
                            <div className="h-bar-fill profit" style={{ width: `${(d.pl / scenarios.maxAbsPL) * 100}%` }}>
                                +{Math.round(d.pl).toLocaleString()}
                            </div>
                        </div>
                    </div>
                ))}
              </div>
              <div style={{ flex: 1 }}>
                <h4>손실 시나리오 (-1 ~ -5)</h4>
                {scenarios.data.filter(d => d.pl < 0).sort((a,b) => b.rate - a.rate).map(d => (
                    <div key={d.rate} className="h-bar-row">
                        <span className="h-bar-label">{d.rate}</span>
                        <div className="h-bar-container">
                             <div className="h-bar-fill loss" style={{ width: `${(Math.abs(d.pl) / scenarios.maxAbsPL) * 100}%` }}>
                                {Math.round(d.pl).toLocaleString()}
                            </div>
                        </div>
                    </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default Calculator;