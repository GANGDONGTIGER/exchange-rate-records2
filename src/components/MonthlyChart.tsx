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
  Legend,
} from 'chart.js';
// 1. 데이터 라벨 플러그인 가져오기
import ChartDataLabels from 'chartjs-plugin-datalabels';

import type { ChartData, ChartOptions } from 'chart.js';

// 2. 플러그인 등록 (ChartDataLabels 추가)
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

interface MonthlyChartProps {
  monthlyData: Record<string, number>;
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
    layout: {
      padding: {
        top: 25, // 숫자가 잘리지 않도록 위쪽 여백 확보
      }
    },
    plugins: {
      legend: { display: false },
      // 3. 데이터 라벨 설정 (여기가 핵심!)
      datalabels: {
        display: true,
        align: 'top', // 점 위쪽에 표시
        anchor: 'end',
        offset: 4,
        color: (context) => {
          // 수익이면 빨강, 손실이면 파랑, 0이면 검정
          const value = context.dataset.data[context.dataIndex] as number;
          return value > 0 ? '#e74c3c' : value < 0 ? '#3498db' : '#555';
        },
        font: {
          weight: 'bold',
          size: 11
        },
        formatter: (value) => {
          // 천 단위 콤마 찍어서 보여주기
          return Math.round(value).toLocaleString();
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (value) => `${value.toLocaleString()}원` },
      },
      x: {
        ticks: {
            font: {
                size: 11 // 모바일에서 글씨 너무 크지 않게
            }
        }
      }
    },
  };

  return (
    <div className="trend-section">
      <h2>월별 손익 추이</h2>
      <div className="chart-wrapper">
        <div className="chart-scroll-container">
          {/* 데이터 양에 따라 너비 자동 조절 (항목당 60px 확보) */}
          <div
            className="chart-content"
            style={{ 
                minWidth: `${Math.max(window.innerWidth < 768 ? 400 : 600, labels.length * 60)}px`, 
                height: '300px' 
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