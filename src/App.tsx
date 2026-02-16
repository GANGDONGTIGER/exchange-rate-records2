// src/App.tsx
import { useState, useEffect, useMemo } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import './App.css';
import MonthlyChart from './components/MonthlyChart';
import LimitStatus from './components/LimitStatus';
import Calculator from './components/Calculator';

// ⚠️ 본인의 Google Apps Script URL 입력 (필수!)
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw0skZAuWgTMGOuTehPepXfIbUihjagRDQfTVaFHVjWbVC2JqRkTNNxGVtE9DMuaHi6cA/exec";

// --- 타입 정의 ---
interface RecordData {
  id: string;
  trader: string;
  type: 'buy' | 'sell';
  timestamp: string;
  target_currency: string;
  foreign_amount: number;
  exchange_rate: number;
  base_amount: number;
  linked_buy_id?: string | null;
}

interface AnalyticsData {
  totalPL: number;
  currentMonthPL: number;
  monthlyPL: Record<string, number>;
  holdings: Record<string, number>;
  avgBuyPrices: Record<string, number>;
  limitUsage: {
    daily: { SW: number; HR: number };
    monthly: { SW: number; HR: number };
  };
  soldBuyIds: string[]; // 매도 완료된 매수 ID 목록
}

interface ApiResponse {
  status: string;
  records: RecordData[];
  analytics: AnalyticsData;
  totalRecords: number;
  allRecordsForFilter?: RecordData[]; // 전체 데이터 (필터링용)
}

interface FormDataState {
  id: string | null; // 수정 모드 식별용
  trader: string;
  type: 'buy' | 'sell';
  currency: string;
  date: string;
  foreignAmount: string;
  exchangeRate: string;
  baseAmount: string;
  linkedBuyId: string;
}

function App() {
  const [allRecords, setAllRecords] = useState<RecordData[]>([]); // 페이지네이션 없는 전체 데이터
  const [records, setRecords] = useState<RecordData[]>([]); // 현재 페이지 데이터
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalPL: 0,
    currentMonthPL: 0,
    monthlyPL: {},
    holdings: {},
    avgBuyPrices: {},
    limitUsage: { daily: { SW: 0, HR: 0 }, monthly: { SW: 0, HR: 0 } },
    soldBuyIds: []
  });
  
  const [loading, setLoading] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [filterTrader, setFilterTrader] = useState<string>('all');

  const [formData, setFormData] = useState<FormDataState>({
    id: null,
    trader: '',
    type: 'buy',
    currency: 'USD',
    date: new Date().toISOString().substring(0, 10),
    foreignAmount: '',
    exchangeRate: '',
    baseAmount: '',
    linkedBuyId: ''
  });

  // --- 데이터 불러오기 ---
  const fetchRecords = async (page: number = 1) => {
    if (!SCRIPT_URL || SCRIPT_URL.includes("여기에")) {
      alert("App.tsx 파일에서 SCRIPT_URL을 먼저 설정해주세요!");
      return;
    }
    
    setLoading(true);
    try {
      // 페이지네이션과 필터링을 서버에서 처리하거나, 전체를 받아와서 클라이언트에서 처리
      // 기존 main.js 방식대로 전체 데이터를 받아 처리하는 구조로 가정
      const response = await fetch(`${SCRIPT_URL}?page=${page}&limit=50`);
      const data: ApiResponse = await response.json();
      
      if (data.records) {
        setRecords(data.records);
        setAnalytics(data.analytics);
        setTotalPages(Math.ceil(data.totalRecords / 50));
        setCurrentPage(page);
        
        // 전체 기록 저장 (계산기나 드롭다운 필터용)
        if (data.allRecordsForFilter) {
            setAllRecords(data.allRecordsForFilter);
        } else {
            // API가 allRecordsForFilter를 안 주면 현재 페이지 데이터라도 씀
            setAllRecords(data.records); 
        }
      }
    } catch (error) {
      console.error("데이터 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(1); }, []);

  // --- 헬퍼 로직 ---
  // 매도 가능한(아직 안 팔린) 매수 기록 찾기
  const availableBuyOptions = useMemo(() => {
    if (formData.type !== 'sell' || !formData.trader) return [];
    
    return allRecords.filter(r => 
        r.type === 'buy' && 
        r.trader === formData.trader && 
        r.target_currency === formData.currency &&
        !analytics.soldBuyIds.includes(r.id.toString())
    );
  }, [allRecords, formData.type, formData.trader, formData.currency, analytics.soldBuyIds]);

  // 입력 핸들러
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    let finalValue = value;
    if (['foreignAmount', 'exchangeRate', 'baseAmount'].includes(name)) {
       finalValue = value.replace(/,/g, '');
       if (isNaN(Number(finalValue))) return; 
    }

    setFormData(prev => {
      const updated = { ...prev, [name]: finalValue };
      
      // 매수 건 선택 시, 해당 건의 정보로 자동 채우기
      if (name === 'linkedBuyId' && value) {
        const selectedBuy = allRecords.find(r => r.id.toString() === value);
        if (selectedBuy) {
            updated.foreignAmount = selectedBuy.foreign_amount.toString();
            // 환율은 매수 당시 환율이 아니라 현재 매도 환율을 입력해야 하므로 비워두거나 유지
        }
      }

      // 원화 환산 자동 계산
      if (['foreignAmount', 'exchangeRate', 'currency'].includes(name)) {
        const amt = parseFloat(updated.foreignAmount || '0');
        const rate = parseFloat(updated.exchangeRate || '0');
        
        if (amt && rate) {
          let calc = amt * rate;
          if (updated.currency === 'JPY') calc /= 100;
          updated.baseAmount = Math.round(calc).toString();
        }
      }
      return updated;
    });
  };

  // 저장 (Create / Update)
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.trader) return alert('거래자를 선택해주세요.');
    if (formData.type === 'sell' && !formData.linkedBuyId) return alert('어떤 매수 건을 파는 것인지 선택해주세요.');
    
    setLoading(true);
    const isUpdate = !!formData.id;
    const action = isUpdate ? 'update' : 'create';
    const payloadId = isUpdate ? formData.id : 't' + Date.now();

    const payload = {
      action: action,
      data: {
        id: payloadId,
        trader: formData.trader,
        type: formData.type,
        target_currency: formData.currency,
        timestamp: new Date(formData.date).toISOString(), 
        foreign_amount: parseFloat(formData.foreignAmount),
        exchange_rate: parseFloat(formData.exchangeRate),
        base_amount: parseInt(formData.baseAmount, 10),
        linked_buy_id: formData.type === 'sell' ? formData.linkedBuyId : null
      }
    };

    try {
      await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
      alert(isUpdate ? '수정되었습니다!' : '저장되었습니다!');
      fetchRecords(currentPage); // 목록 새로고침
      // 폼 초기화
      setFormData({ id: null, trader: '', type: 'buy', currency: 'USD', date: new Date().toISOString().substring(0, 10), foreignAmount: '', exchangeRate: '', baseAmount: '', linkedBuyId: '' });
    } catch (error) {
      alert('작업 실패: ' + String(error));
    } finally {
      setLoading(false);
    }
  };

  // 삭제 핸들러
  const handleDelete = async (id: string) => {
    if(!confirm("정말 삭제하시겠습니까?")) return;
    setLoading(true);
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', id: id })
        });
        alert("삭제되었습니다.");
        fetchRecords(currentPage);
    } catch(e) {
        alert("삭제 실패");
    } finally {
        setLoading(false);
    }
  };

  // 수정 버튼 클릭 시 폼 채우기
  const handleEdit = (record: RecordData) => {
    if (record.type === 'sell') {
        alert("매도 기록은 데이터 꼬임 방지를 위해 삭제 후 다시 입력해주세요.");
        return;
    }
    setFormData({
        id: record.id,
        trader: record.trader,
        type: record.type,
        currency: record.target_currency,
        date: record.timestamp.substring(0, 10),
        foreignAmount: record.foreign_amount.toString(),
        exchangeRate: record.exchange_rate.toString(),
        baseAmount: record.base_amount.toString(),
        linkedBuyId: record.linked_buy_id || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatNum = (num: string | number) => num ? Number(num).toLocaleString() : '';

  // 필터링된 목록
  const displayedRecords = filterTrader === 'all' 
    ? records 
    : records.filter(r => r.trader === filterTrader);

  return (
    <div id="app">
      {loading && <div id="loading-overlay"><div className="spinner"></div></div>}

      <header>
        <h1>이서👧🏻,다람이네🐻 부자되기</h1>
      </header>

      <main>
        {/* 계산기 컴포넌트 추가 */}
        <Calculator records={allRecords} soldBuyIds={analytics.soldBuyIds} />

        <section className="dashboard-section">
          <h2>요약 정보</h2>
          <div className="dashboard-grid">
            <div className="dashboard-item">
              <h3>총 실현 손익</h3>
              <p className={analytics.totalPL >= 0 ? 'profit' : 'loss'}>{Math.round(analytics.totalPL).toLocaleString()} 원</p>
            </div>
            <div className="dashboard-item">
              <h3>당월 손익</h3>
              <p className={analytics.currentMonthPL >= 0 ? 'profit' : 'loss'}>{Math.round(analytics.currentMonthPL).toLocaleString()} 원</p>
            </div>
            <div className="dashboard-item">
              <h3>현재 보유 외화</h3>
              <div>{Object.entries(analytics.holdings).map(([curr, amt]) => (<p key={curr}>{curr}: {Number(amt).toLocaleString()}</p>))}</div>
            </div>
            <div className="dashboard-item">
              <h3>평균 매입가</h3>
              <div>{Object.entries(analytics.avgBuyPrices).map(([curr, price]) => (<p key={curr}>{curr}: {Number(price).toLocaleString()} 원</p>))}</div>
            </div>
          </div>
        </section>

        {/* 한도 현황 컴포넌트 추가 */}
        <LimitStatus limitUsage={analytics.limitUsage} />

        <MonthlyChart monthlyData={analytics.monthlyPL} />

        <section className="form-section">
          <form onSubmit={handleSubmit}>
            <fieldset>
              <legend>{formData.id ? '기록 수정' : '새 환전 기록 추가'}</legend>
              
              <div className="form-group">
                <label>거래자</label>
                <div className="button-group">
                  {['SW', 'HR'].map(t => (
                    <button key={t} type="button" className={`btn-trader ${formData.trader === t ? 'active' : ''}`} onClick={() => setFormData({...formData, trader: t})}>{t}</button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>거래 통화</label>
                <div className="button-group">
                  {['USD', 'JPY', 'EUR', 'CAD', 'AUD', 'NZD', 'HKD', 'SGD'].map(c => (
                    <button key={c} type="button" className={`btn-currency ${formData.currency === c ? 'active' : ''}`} onClick={() => setFormData({...formData, currency: c})}>{c}</button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>거래 종류</label>
                <div className="button-group">
                    <button type="button" className={`btn-type ${formData.type === 'buy' ? 'active' : ''}`} onClick={() => setFormData({...formData, type: 'buy', linkedBuyId: ''})}>외화 매수</button>
                    <button type="button" className={`btn-type ${formData.type === 'sell' ? 'active' : ''}`} onClick={() => setFormData({...formData, type: 'sell'})}>외화 매도</button>
                </div>
              </div>

              {formData.type === 'sell' && (
                  <div className="form-group">
                      <label>매수 건 선택</label>
                      <select name="linkedBuyId" value={formData.linkedBuyId} onChange={handleInputChange} style={{ width: '100%', padding: '10px' }}>
                          <option value="">-- 어떤 매수 건을 파시나요? --</option>
                          {availableBuyOptions.map(opt => (
                              <option key={opt.id} value={opt.id}>
                                  {opt.timestamp.substring(0, 10)} / {opt.target_currency} {opt.foreign_amount.toLocaleString()} (환율: {opt.exchange_rate})
                              </option>
                          ))}
                      </select>
                  </div>
              )}

              <div className="form-group">
                 <label>거래 날짜</label>
                 <input type="date" name="date" value={formData.date} onChange={handleInputChange} />
              </div>

              <div className="form-row">
                <div className="form-group">
                   <label>금액 (외화)</label>
                   <input type="text" name="foreignAmount" value={formatNum(formData.foreignAmount)} onChange={handleInputChange} placeholder="예: 100" />
                </div>
                <div className="form-group">
                   <label>환율</label>
                   <input type="text" name="exchangeRate" value={formatNum(formData.exchangeRate)} onChange={handleInputChange} placeholder="예: 1300" />
                </div>
              </div>

               <div className="form-group">
                   <label>원화 환산</label>
                   <input type="text" name="baseAmount" value={formatNum(formData.baseAmount)} readOnly placeholder="자동 계산" />
                </div>

              <button type="submit">{formData.id ? '수정 완료' : '저장하기'}</button>
              {formData.id && <button type="button" onClick={() => setFormData({ id: null, trader: '', type: 'buy', currency: 'USD', date: new Date().toISOString().substring(0, 10), foreignAmount: '', exchangeRate: '', baseAmount: '', linkedBuyId: '' })} style={{ marginTop: '10px', background: '#95a5a6' }}>취소</button>}
            </fieldset>
          </form>
        </section>

        <section className="list-section">
          <h2>거래 히스토리</h2>
          <div className="filter-controls" style={{ marginBottom: '15px' }}>
             <button className={`filter-btn ${filterTrader === 'all' ? 'active' : ''}`} onClick={() => setFilterTrader('all')}>전체</button>
             <button className={`filter-btn ${filterTrader === 'SW' ? 'active' : ''}`} onClick={() => setFilterTrader('SW')}>SW</button>
             <button className={`filter-btn ${filterTrader === 'HR' ? 'active' : ''}`} onClick={() => setFilterTrader('HR')}>HR</button>
          </div>
          
          <div className="table-container">
            <table className="record-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>거래자</th>
                  <th>통화</th>
                  <th>금액</th>
                  <th>환율</th>
                  <th>원화금액</th>
                  <th>타입</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {displayedRecords.map(record => (
                  <tr key={record.id} className={analytics.soldBuyIds.includes(record.id.toString()) ? 'record-completed' : ''}>
                    <td>{record.timestamp.substring(0, 10)}</td>
                    <td>{record.trader}</td>
                    <td>{record.target_currency}</td>
                    <td>{Number(record.foreign_amount).toLocaleString()}</td>
                    <td>{Number(record.exchange_rate).toLocaleString()}</td>
                    <td>{Math.round(record.base_amount).toLocaleString()}</td>
                    <td style={{ color: record.type === 'buy' ? '#3498db' : '#e74c3c', fontWeight: 'bold' }}>
                      {record.type === 'buy' ? '매수' : '매도'}
                    </td>
                    <td>
                        <button onClick={() => handleEdit(record)} style={{ marginRight: '5px', border: 'none', background: 'none', cursor: 'pointer' }}>✏️</button>
                        <button onClick={() => handleDelete(record.id)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="pagination-controls">
              <button disabled={currentPage === 1} onClick={() => fetchRecords(currentPage - 1)}>이전</button>
              <span style={{ margin: '0 10px', fontWeight: 'bold' }}>Page {currentPage} / {totalPages}</span>
              <button disabled={currentPage === totalPages} onClick={() => fetchRecords(currentPage + 1)}>다음</button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;