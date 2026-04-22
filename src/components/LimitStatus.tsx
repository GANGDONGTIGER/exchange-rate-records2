import React from 'react';

interface LimitStatusProps {
  limitUsage: {
    daily: { SW: number; HR: number };
    monthly: { SW: number; HR: number };
  };
}

const LimitStatus: React.FC<LimitStatusProps> = ({ limitUsage }) => {
  const DAILY_MAX = 10000000;
  const MONTHLY_MAX = 100000000;

  const renderBar = (current: number, max: number, colorClass: string) => {
    const percentage = Math.min((current / max) * 100, 100);
    const remaining = max - current;
    
    return (
      // ✅ 부모에 display: flex 적용
      <div className="limit-tracker" style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '10px' }}>
        
        {/* ✅ 라벨: 찌그러짐 방지 flexShrink: 0 */}
        <span className="tracker-label" style={{ width: '30px', flexShrink: 0, fontWeight: 'bold' }}>
          {colorClass}
        </span>
        
        {/* ✅ 막대그래프: 남는 공간 전부 차지 flex: 1 */}
        <div className="progress-bar-container" style={{ flex: 1, margin: '0 10px' }}>
          <div 
            className="progress-bar-fill" 
            style={{ 
              width: `${percentage}%`, 
              backgroundColor: colorClass === 'SW' ? '#3498db' : '#f7a8b8' 
            }}
          ></div>
        </div>
        
        {/* ✅ 잔여 금액: 찌그러짐 방지 flexShrink: 0 */}
        <span className="tracker-remaining" style={{ width: '110px', flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap', fontSize: '13px' }}>
          잔여: {remaining.toLocaleString()}원
        </span>
      </div>
    );
  };

  return (
    <section className="limit-dashboard-section">
      <h2>한도 현황</h2>
      {/* 인라인 스타일 제거됨 -> CSS .limit-container가 반응형 처리 */}
      <div className="limit-container">
        <div className="limit-item">
          <h3>일 매수 (최대 1,000만원)</h3>
          {renderBar(limitUsage.daily.SW, DAILY_MAX, 'SW')}
          {renderBar(limitUsage.daily.HR, DAILY_MAX, 'HR')}
        </div>
        <div className="limit-item">
          <h3>월 매수 (최대 1억원)</h3>
          {renderBar(limitUsage.monthly.SW, MONTHLY_MAX, 'SW')}
          {renderBar(limitUsage.monthly.HR, MONTHLY_MAX, 'HR')}
        </div>
      </div>
    </section>
  );
};

export default LimitStatus;