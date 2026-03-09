// src/App.tsx
import { useState, useEffect, useMemo, Fragment, lazy, Suspense } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import './App.css';

// ✅ [추가] 파이어베이스 라이브러리와 열쇠(db) 가져오기
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';

const MonthlyChart = lazy(() => import('./components/MonthlyChart'));
import LimitStatus from './components/LimitStatus';
import Calculator from './components/Calculator';

// --- ❌ 기존 GAS SCRIPT_URL 삭제됨 ---

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
  pl?: number; 
  fee?: number; // ✅ [추가] 파이어베이스용 수수료 속성
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
  soldBuyIds: string[];
}

interface FormDataState {
  id: string | null;
  trader: string;
  type: 'buy' | 'sell' | ''; // 사용자가 빈 값도 허용하도록 수정했던 부분 유지
  currency: string;
  date: string;
  foreignAmount: string;
  exchangeRate: string;
  baseAmount: string;
  linkedBuyId: string;
  fee: string;
}

// ✅ [추가] 구글 서버가 하던 '통계 연산'을 내 기기에서 빛의 속도로 처리하는 함수
const calculateAnalytics = (records: RecordData[]): AnalyticsData => {
  let totalPL = 0;
  let currentMonthPL = 0;
  const monthlyPL: Record<string, number> = {};
  const holdings: Record<string, number> = {};
  const buyStats: Record<string, { amt: number; cost: number }> = {};
  const soldBuyIds: string[] = [];
  const limitUsage = { daily: { SW: 0, HR: 0 }, monthly: { SW: 0, HR: 0 } };

  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const buyRecordMap = new Map(records.filter(r => r.type === 'buy').map(r => [r.id, r]));

  // 실현 손익 및 매도된 매수 건 추적
  records.filter(r => r.type === 'sell' && r.linked_buy_id).forEach(sellRecord => {
    if (sellRecord.linked_buy_id) {
      soldBuyIds.push(sellRecord.linked_buy_id);
      const originalBuy = buyRecordMap.get(sellRecord.linked_buy_id);
      if (originalBuy) {
        const profit = sellRecord.base_amount - originalBuy.base_amount;
        totalPL += profit;
        const sellMonth = sellRecord.timestamp.substring(0, 7);
        monthlyPL[sellMonth] = (monthlyPL[sellMonth] || 0) + profit;
        if (sellMonth === currentYearMonth) currentMonthPL += profit;
      }
    }
  });

  // 보유 외화 및 평단가 계산
  const unsoldBuys = records.filter(r => r.type === 'buy' && !soldBuyIds.includes(r.id));
  unsoldBuys.forEach(r => {
    const curr = r.target_currency;
    holdings[curr] = (holdings[curr] || 0) + r.foreign_amount;
    if (!buyStats[curr]) buyStats[curr] = { amt: 0, cost: 0 };
    buyStats[curr].amt += r.foreign_amount;
    buyStats[curr].cost += r.base_amount;
  });

  const avgBuyPrices: Record<string, number> = {};
  for (const curr in buyStats) {
    let avg = buyStats[curr].cost / buyStats[curr].amt;
    if (curr === 'JPY') avg *= 100;
    avgBuyPrices[curr] = avg;
  }

  return { totalPL, currentMonthPL, monthlyPL, holdings, avgBuyPrices, limitUsage, soldBuyIds };
};


function App() {
  const [allRecords, setAllRecords] = useState<RecordData[]>([]); 
  const [records, setRecords] = useState<RecordData[]>([]); 
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalPL: 0, currentMonthPL: 0, monthlyPL: {}, holdings: {}, avgBuyPrices: {},
    limitUsage: { daily: { SW: 0, HR: 0 }, monthly: { SW: 0, HR: 0 } }, soldBuyIds: []
  });
  
  const [loading, setLoading] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [filterTrader, setFilterTrader] = useState<string>('all');

  const [formData, setFormData] = useState<FormDataState>({
    id: null,
    trader: '',
    type: 'buy', // 사용자님 코드 유지
    currency: 'USD', // 사용자님 코드 유지
    date: new Date().toISOString().substring(0, 10),
    foreignAmount: '',
    exchangeRate: '',
    baseAmount: '',
    linkedBuyId: '',
    fee: '' 
  });

  // --- 🚀 데이터 불러오기 (Firebase Firestore) ---
  const fetchRecords = async (page: number = 1) => {
    const hasCache = localStorage.getItem('cached_records');
    if (!hasCache) setLoading(true);
    
    try {
      // 파이어베이스에서 시간 역순으로 전체 데이터 가져오기
      const q = query(collection(db, 'records'), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const fetchedData: RecordData[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RecordData[];

      // 프론트엔드 연산기로 통계 도출
      const newAnalytics = calculateAnalytics(fetchedData);
      
      // 페이지네이션 처리 (클라이언트)
      const limit = 50;
      const offset = (page - 1) * limit;
      const paginatedData = fetchedData.slice(offset, offset + limit);
      
      setAllRecords(fetchedData);
      setRecords(paginatedData);
      setAnalytics(newAnalytics);
      setTotalPages(Math.ceil(fetchedData.length / limit) || 1);
      setCurrentPage(page);
      
      // 초고속 로딩을 위한 캐시 저장 (기존 기능 유지)
      localStorage.setItem('cached_records', JSON.stringify(paginatedData));
      localStorage.setItem('cached_analytics', JSON.stringify(newAnalytics));
      localStorage.setItem('cached_allRecords', JSON.stringify(fetchedData));
      
    } catch (error) {
      console.error("데이터 로드 실패:", error);
      alert("데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false); 
    }
  };

  // 앱이 처음 켜질 때 실행되는 마법 (기존 캐싱 로직 유지)
  useEffect(() => {
    const cachedRecords = localStorage.getItem('cached_records');
    const cachedAnalytics = localStorage.getItem('cached_analytics');
    const cachedAll = localStorage.getItem('cached_allRecords');

    if (cachedRecords && cachedAnalytics && cachedAll) {
      setRecords(JSON.parse(cachedRecords));
      setAnalytics(JSON.parse(cachedAnalytics));
      setAllRecords(JSON.parse(cachedAll));
    }
    fetchRecords(1); 
  }, []);

  // BTC를 제외한 한도 사용량 프론트엔드 직접 계산 (기존 로직 유지)
  const calculatedLimitUsage = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    const todayStr = `${year}-${month}-${day}`;
    const currentMonthStr = `${year}-${month}`;

    const usage = { daily: { SW: 0, HR: 0 }, monthly: { SW: 0, HR: 0 } };

    allRecords.forEach(record => {
      if (record.type === 'buy' && record.target_currency !== 'BTC') {
        const recordDate = record.timestamp.substring(0, 10);
        const recordMonth = record.timestamp.substring(0, 7);
        const trader = record.trader as 'SW' | 'HR';

        if (usage.daily[trader] !== undefined && recordDate === todayStr) usage.daily[trader] += record.base_amount;
        if (usage.monthly[trader] !== undefined && recordMonth === currentMonthStr) usage.monthly[trader] += record.base_amount;
      }
    });
    return usage;
  }, [allRecords]);

  // '원화 환산' 자동 계산 로직 (기존 로직 유지)
  useEffect(() => {
    if (formData.currency === '주식') return;
    const amt = parseFloat(formData.foreignAmount || '0');
    const rate = parseFloat(formData.exchangeRate || '0');
    const feeAmt = parseFloat(formData.fee || '0'); 

    if (!isNaN(amt) && !isNaN(rate)) {
      let calc = amt * rate;
      if (formData.currency === 'BTC') {
        calc = formData.type === 'buy' ? calc + feeAmt : calc - feeAmt;
      } else if (formData.currency === 'JPY') {
        calc /= 100;
      }
      const newBaseAmount = Math.round(calc).toString();
      if (formData.baseAmount !== newBaseAmount) setFormData(prev => ({ ...prev, baseAmount: newBaseAmount }));
    } else if (formData.baseAmount !== '') {
      setFormData(prev => ({ ...prev, baseAmount: '' }));
    }
  }, [formData.foreignAmount, formData.exchangeRate, formData.fee, formData.currency, formData.type]);

  // 매도 가능한 매수 기록 찾기
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
    
    if (['foreignAmount', 'exchangeRate', 'baseAmount', 'fee'].includes(name)) {
       finalValue = value.replace(/,/g, ''); 
       if (finalValue !== '' && finalValue !== '.' && isNaN(Number(finalValue))) return; 
    }

    setFormData(prev => {
      const updated = { ...prev, [name]: finalValue };
      if (name === 'linkedBuyId' && value) {
        const selectedBuy = allRecords.find(r => r.id.toString() === value);
        if (selectedBuy) updated.foreignAmount = selectedBuy.foreign_amount.toString();
      }
      return updated;
    });
  };

  // --- 🚀 저장 (Firebase Create / Update) ---
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.trader) return alert('거래자를 선택해주세요.');
    if (formData.type === 'sell' && !formData.linkedBuyId) return alert('어떤 매수 건을 파는 것인지 선택해주세요.');
    
    setLoading(true);
    const isUpdate = !!formData.id;

    // ✅ [최종 수정] 자바스크립트의 영국 시간(UTC) 변환 자체를 무시하고, 화면에 보이는 텍스트 그대로 강제 조립!
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    // 사용자가 고른 달력 날짜에 현재 시간을 그냥 글자로 이어 붙여버립니다. (예: "2026-03-05T08:44:00.000Z")
    const fixedTimestamp = `${formData.date}T${hh}:${mm}:${ss}.000Z`;


    // 파이어베이스에 보낼 데이터 포장
    const payload = {
      trader: formData.trader,
      type: formData.type,
      target_currency: formData.currency,
      timestamp: fixedTimestamp,
      // ✅ [수정] 주식일 때는 외화, 환율, 수수료를 무조건 0으로 꽂아줍니다. base_amount만 중요!
      foreign_amount: formData.currency === '주식' ? 0 : parseFloat(formData.foreignAmount || '0'),
      exchange_rate: formData.currency === '주식' ? 0 : parseFloat(formData.exchangeRate || '0'),
      base_amount: parseInt(formData.baseAmount || '0', 10),
      linked_buy_id: formData.type === 'sell' ? formData.linkedBuyId : null,
      fee: formData.currency === '주식' ? 0 : parseFloat(formData.fee || '0')
    };

    try {
      if (isUpdate && formData.id) {
        // 기존 문서 수정
        await updateDoc(doc(db, 'records', formData.id), payload);
        alert('수정되었습니다!');
      } else {
        // 새 문서 추가
        await addDoc(collection(db, 'records'), payload);
        alert('저장되었습니다!');
      }
      fetchRecords(currentPage); 
      setFormData({ id: null, trader: '', type: 'buy', currency: 'USD', date: new Date().toISOString().substring(0, 10), foreignAmount: '', exchangeRate: '', baseAmount: '', linkedBuyId: '', fee: '' });
    } catch (error) {
      alert('작업 실패: ' + String(error));
    } finally {
      setLoading(false);
    }
  };

  // --- 🚀 삭제 (Firebase Delete) ---
  const handleDelete = async (id: string) => {
    if(!confirm("정말 삭제하시겠습니까?")) return;
    setLoading(true);
    try {
        await deleteDoc(doc(db, 'records', id));
        alert("삭제되었습니다.");
        fetchRecords(currentPage);
    } catch(e) {
        alert("삭제 실패");
    } finally {
        setLoading(false);
    }
  };

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
        linkedBuyId: record.linked_buy_id || '',
        fee: record.fee ? record.fee.toString() : ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatDisplayValue = (value: string | number) => {
      if (value === null || value === undefined || value === '') return '';
      const strVal = String(value).replace(/,/g, ''); 
      if (strVal === '.') return '.'; 
      const parts = strVal.split('.');
      parts[0] = Number(parts[0]).toLocaleString(); 
      return parts.length > 1 ? `${parts[0]}.${parts[1]}` : parts[0];
  };

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
              <div style={{display: 'inline-block', textAlign:'left'}}>{Object.entries(analytics.holdings).map(([curr, amt]) => (<p key={curr}>{curr}: {Number(amt).toLocaleString()}</p>))}</div>
            </div>
            <div className="dashboard-item">
              <h3>평균 매입가</h3>
              <div style={{display: 'inline-block', textAlign:'left'}}>{Object.entries(analytics.avgBuyPrices).map(([curr, price]) => (<p key={curr}>{curr}: {Number(price).toLocaleString()} 원</p>))}</div>
            </div>
          </div>
        </section>

        <LimitStatus limitUsage={calculatedLimitUsage} />
        <Suspense>
          <MonthlyChart monthlyData={analytics.monthlyPL} />
        </Suspense>

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
                <label>거래 종목</label>
                <div className="button-group">
                  {['USD', 'JPY', 'EUR', 'CAD', 'AUD', 'NZD', 'HKD', 'SGD', 'BTC', '주식'].map(c => (
                    <button key={c} type="button" className={`btn-currency ${formData.currency === c ? 'active' : ''}`} onClick={() => setFormData({...formData, currency: c})}>{c}</button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>거래 종류</label>
                <div className="button-group">
                    <button type="button" className={`btn-type ${formData.type === 'buy' ? 'active' : ''}`} onClick={() => setFormData({...formData, type: 'buy', linkedBuyId: ''})}>매수</button>
                    <button type="button" className={`btn-type ${formData.type === 'sell' ? 'active' : ''}`} onClick={() => setFormData({...formData, type: 'sell'})}>매도</button>
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

              {formData.currency !== '주식' ? (
                <>
                  <div className="form-row">
                    <div className="form-group">
                       <label>금액 (외화)</label>
                       <input type="text" name="foreignAmount" value={formatDisplayValue(formData.foreignAmount)} onChange={handleInputChange} placeholder="예: 100" />
                    </div>
                    <div className="form-group">
                       <label>환율</label>
                       <input type="text" name="exchangeRate" value={formatDisplayValue(formData.exchangeRate)} onChange={handleInputChange} placeholder="예: 1300" />
                    </div>
                  </div>
                  
                  {formData.currency === 'BTC' && (
                      <div className="form-group" style={{ marginTop: '-10px', marginBottom: '15px' }}>
                         <label style={{ color: '#e67e22', fontWeight: 'bold' }}>수수료 (원화)</label>
                         <input type="text" name="fee" value={formatDisplayValue(formData.fee)} onChange={handleInputChange} placeholder="예: 5000" style={{ borderColor: '#e67e22' }} />
                      </div>
                  )}    
                   <div className="form-group">
                       <label>원화 환산</label>
                       <input type="text" name="baseAmount" value={formatDisplayValue(formData.baseAmount)} readOnly placeholder="자동 계산" />
                    </div>
                </>
                ) : (
                /* ✅ [추가] 통화가 '주식'일 때만 노출되는 단일 입력창! */
                <div className="form-group">
                   <label style={{ color: '#8e44ad', fontWeight: 'bold' }}>거래 금액</label>
                   <input 
                     type="text" 
                     name="baseAmount" 
                     value={formatDisplayValue(formData.baseAmount)} 
                     onChange={handleInputChange} 
                     placeholder="예: 1000000" 
                     style={{ borderColor: '#8e44ad' }} 
                   />
                </div>
              )}
              <button type="submit">{formData.id ? '수정 완료' : '저장하기'}</button>
              {formData.id && <button type="button" onClick={() => setFormData({ id: null, trader: '', type: 'buy', currency: 'USD', date: new Date().toISOString().substring(0, 10), foreignAmount: '', exchangeRate: '', baseAmount: '', linkedBuyId: '', fee: '' })} style={{ marginTop: '10px', background: '#95a5a6' }}>취소</button>}
            </fieldset>
          </form>
        </section>

        <section className="list-section">
          <h2>거래 히스토리</h2>
          <div className="filter-controls">
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
                  <th>손익</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {displayedRecords.map(record => {
                  const isCompleted = analytics.soldBuyIds.includes(record.id.toString()) || record.type === 'sell';
                  
                  let calculatedPL = record.pl; 
                  let linkedBuy = null; 

                  if (record.type === 'sell' && record.linked_buy_id) {
                      linkedBuy = allRecords.find(r => r.id.toString() === record.linked_buy_id);
                      if (calculatedPL === undefined && linkedBuy) {
                          calculatedPL = record.base_amount - linkedBuy.base_amount;
                      }
                  }

                  return (
                    <Fragment key={record.id}>
                      <tr className={isCompleted ? 'record-completed' : ''}>
                        <td>{record.timestamp.substring(0, 10)}</td>
                        <td>{record.trader}</td>
                        <td>{record.target_currency}</td>
                        <td className="record-foreign-amount">{Number(record.foreign_amount).toLocaleString()}</td>
                        <td className="record-rate">{Number(record.exchange_rate).toLocaleString()}</td>
                        <td className="record-base-amount">{Math.round(record.base_amount).toLocaleString()}</td>
                        <td style={{ color: record.type === 'buy' ? '#3498db' : '#e74c3c', fontWeight: 'bold' }}>
                          {record.type === 'buy' ? '매수' : '매도'}
                        </td>
                        <td className={`record-pl ${calculatedPL && calculatedPL > 0 ? 'profit' : calculatedPL && calculatedPL < 0 ? 'loss' : ''}`}>
                          {record.type === 'sell' && calculatedPL !== undefined
                            ? `${Math.round(calculatedPL).toLocaleString()}`
                            : '-'}
                        </td>
                        <td className="record-actions">
                            <button className="edit-btn" onClick={() => handleEdit(record)}>✏️</button>
                            <button className="delete-btn" onClick={() => handleDelete(record.id)}>🗑️</button>
                        </td>
                      </tr>
                      {record.type === 'sell' && linkedBuy && (
                        <tr className="linked-buy-row">
                          <td colSpan={3} className="link-arrow">
                            ↳ 매수 원본
                          </td>
                          <td colSpan={6} className="linked-buy-details">
                            {linkedBuy.timestamp.substring(0, 10)} | 금액: {Number(linkedBuy.foreign_amount).toLocaleString()} {linkedBuy.target_currency} | 환율: {Number(linkedBuy.exchange_rate).toLocaleString()} | 원화: {Math.round(linkedBuy.base_amount).toLocaleString()}원
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="pagination-controls">
              <button disabled={currentPage === 1} onClick={() => fetchRecords(currentPage - 1)}>이전</button>
              <span id="page-info">Page {currentPage} / {totalPages}</span>
              <button disabled={currentPage === totalPages} onClick={() => fetchRecords(currentPage + 1)}>다음</button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;