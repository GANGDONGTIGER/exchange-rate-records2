// src/components/MonthlyChart.tsx
import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

import type { ChartData, ChartOptions } from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// [타입 정의] props로 들어올 데이터의 형태를 미리 약속합니다.
interface MonthlyChartProps {
  monthlyData: Record<string, number>; // 키는 문자열(날짜), 값은 숫자(금액)
}

const MonthlyChart: React.FC<MonthlyChartProps> = ({ monthlyData }) => {
  if (!monthlyData || Object.keys(monthlyData).length === 0) {
    return <p style={{ textAlign: 'center', padding: '20px' }}>데이터가 없습니다.</p>;
  }

  const sortedMonths = Object.keys(monthlyData).sort();
  const labels = sortedMonths.map((m) => m.replace('-', '.'));
  const dataPoints = sortedMonths.map((month) => monthlyData[month]);

  const data: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: '월별 손익',
        data: dataPoints,
        borderColor: '#3498db',
        backgroundColor: 'rgba(52, 152, 219, 0.1)',
        tension: 0.3,
        fill: true,
        pointRadius: 5,
        pointBackgroundColor: '#3498db',
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (value) => `${value.toLocaleString()}원` },
      },
    },
  };

  return (
    <div className="trend-section" style={{ overflow: 'hidden' }}> {/* overflow: hidden 추가 */}
      <h2>월별 손익 추이</h2>
      <div className="chart-wrapper" style={{ padding: '10px 0' }}> {/* 패딩 조정 */}
        <div className="chart-scroll-container">
          <div
            className="chart-content"
            style={{ 
                minWidth: `${Math.max(600, labels.length * 50)}px`, /* 간격 조금 줄임 */
                height: '250px' /* 모바일에서 너무 높지 않게 조정 */
            }}
          >
            <Line data={data} options={options} />
          </div>
        </div>
      </div>
    </div>
    );
};

export default MonthlyChart;