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
      <div className="limit-tracker">
        <span className="tracker-label">{colorClass}</span>
        <div className="progress-bar-container">
          <div 
            className="progress-bar-fill" 
            style={{ 
              width: `${percentage}%`, 
              backgroundColor: colorClass === 'SW' ? '#3498db' : '#f7a8b8' 
            }}
          ></div>
        </div>
        <span className="tracker-remaining">
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