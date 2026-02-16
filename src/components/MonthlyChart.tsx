// src/components/MonthlyChart.tsx
import React, { useRef, useEffect } from 'react'; // [추가] 훅 가져오기
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
import ChartDataLabels from 'chartjs-plugin-datalabels';
import type { ChartData, ChartOptions } from 'chart.js';

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
  // [추가] 스크롤 컨테이너를 제어하기 위한 ref 생성
  const scrollRef = useRef<HTMLDivElement>(null);

  // [추가] 데이터가 변경되면 스크롤을 항상 오른쪽 끝으로 이동
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [monthlyData]);

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
        top: 25,
      }
    },
    plugins: {
      legend: { display: false },
      datalabels: {
        display: true,
        align: 'top',
        anchor: 'end',
        offset: 4,
        color: (context) => {
          const value = context.dataset.data[context.dataIndex] as number;
          return value > 0 ? '#e74c3c' : value < 0 ? '#3498db' : '#555';
        },
        font: {
          weight: 'bold',
          size: 11
        },
        formatter: (value) => {
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
                size: 11
            }
        }
      }
    },
  };

  return (
    <div className="trend-section">
      <h2>월별 손익 추이</h2>
      <div className="chart-wrapper">
        {/* [수정] ref 연결 */}
        <div className="chart-scroll-container" ref={scrollRef}>
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