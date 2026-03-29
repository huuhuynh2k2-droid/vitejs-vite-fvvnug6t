// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  Users, 
  BookOpen, 
  Plus, 
  X, 
  Image as ImageIcon, 
  Star,
  Activity,
  FileText,
  Stethoscope,
  Pill,
  Save,
  ChevronRight,
  ChevronLeft,
  Tag,
  LogOut,
  Lock,
  Loader2,
  Table as TableIcon,
  List as ListIcon,
  Trash2,
  Syringe,
  FileQuestion,
  Sparkles,
  Bot,
  AlertCircle,
  UserCircle
} from 'lucide-react';

// --- FIREBASE IMPORTS & INIT ---
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  doc, 
  setDoc,
  deleteDoc 
} from 'firebase/firestore';

// =========================================================================
// CẤU HÌNH FIREBASE CỦA BẠN (GIỮ NGUYÊN KHÔNG ĐỔI)
// =========================================================================
const firebaseConfig = { 
  apiKey : "AIzaSyD3EvyO5f7J-eoyBklY51QaM2JLUAhWiXM" , 
  authDomain : "quan-ly-a7291.firebaseapp.com" , 
  projectId : "quan-ly-a7291" , 
  storageBucket : "quan-ly-a7291.firebasestorage.app" , 
  messagingSenderId : "286963577707" , 
  appId : "1:286963577707:web:d47f59a3701870cfe9122e" , 
  measurementId : "G-JX5WT5H5XV" 
};
const app = initializeApp(customFirebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Các thẻ phân loại mặc định
const PREDEFINED_TAGS = ['Giao ban', 'Bệnh lạ', 'Ca khó', 'Nghiên cứu KH', 'Theo dõi sát'];
const DEPARTMENTS = ['Nội', 'Ngoại', 'Sản', 'Nhi', 'Khác'];

// Fields Cận Lâm Sàng Chuẩn
const CBC_FIELDS = [
  { key: 'wbc', label: 'WBC', unit: 'K/uL' },
  { key: 'rbc', label: 'RBC', unit: 'M/uL' },
  { key: 'hgb', label: 'HGB', unit: 'g/dL' },
  { key: 'plt', label: 'PLT', unit: 'K/uL' },
  { key: 'neu', label: '% Neu', unit: '%' }
];

const BIOCHEM_FIELDS = [
  { key: 'glu', label: 'Glucose', unit: 'mmol/L' },
  { key: 'urea', label: 'Urea', unit: 'mmol/L' },
  { key: 'crea', label: 'Creatinine', unit: 'µmol/L' },
  { key: 'ast', label: 'AST', unit: 'U/L' },
  { key: 'alt', label: 'ALT', unit: 'U/L' },
  { key: 'na', label: 'Na+', unit: 'mmol/L' },
  { key: 'k', label: 'K+', unit: 'mmol/L' },
  { key: 'crp', label: 'CRP', unit: 'mg/L' }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('calendar');
  const [patients, setPatients] = useState([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [selectedDayPatients, setSelectedDayPatients] = useState(null);
  const [selectedReviewTag, setSelectedReviewTag] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  // --- KIỂM TRA TRẠNG THÁI ĐĂNG NHẬP (TỰ ĐỘNG LƯU PHIÊN) ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- FIREBASE FIRESTORE SYNC (THEO TÀI KHOẢN CÁ NHÂN) ---
  useEffect(() => {
    if (!user) {
      setPatients([]);
      return;
    }
    
    // Lưu và đồng bộ dữ liệu vào thư mục riêng của tài khoản (user.uid)
    const patientsRef = collection(db, 'users', user.uid, 'patients');
    const unsubscribe = onSnapshot(patientsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPatients(data);
      
      if (selectedDayPatients) {
        setSelectedDayPatients(prev => {
          if (!prev) return null;
          return { ...prev, patients: data.filter(p => isPatientActiveOnDate(p, prev.date)) };
        });
      }
    }, (error) => {
      console.error("Lỗi tải dữ liệu bệnh nhân:", error);
    });

    return () => unsubscribe();
  }, [user, selectedDayPatients]);

  // --- LOGIC LỊCH ---
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    const emptyDaysCount = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < emptyDaysCount; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const isPatientActiveOnDate = (patient, date) => {
    if (!date || !patient.admissionDate) return false;
    const checkDate = new Date(date).setHours(0,0,0,0);
    const admDate = new Date(patient.admissionDate).setHours(0,0,0,0);
    const disDate = patient.dischargeDate ? new Date(patient.dischargeDate).setHours(0,0,0,0) : new Date(2099, 11, 31).getTime();
    return checkDate >= admDate && checkDate <= disDate;
  };

  const getActivePatientsForDate = (date) => {
    return patients.filter(p => isPatientActiveOnDate(p, date));
  };

  // --- LOGIC NHÓM BỆNH ---
  const groupedPatients = patients.reduce((acc, patient) => {
    const dept = patient.department || 'Khác';
    const diag = patient.currentDiagnosis || patient.diagnosis || patient.initialDiagnosis || 'Chưa xác định';
    if (!acc[dept]) acc[dept] = {};
    if (!acc[dept][diag]) acc[dept][diag] = [];
    acc[dept][diag].push(patient);
    return acc;
  }, {});

  const allUsedTags = Array.from(new Set(patients.flatMap(p => p.tags || [])));

  const handleSavePatient = async (patientData) => {
    if (!user) return;
    try {
      const patientId = patientData.id || Date.now().toString();
      const docRef = doc(db, 'users', user.uid, 'patients', patientId);
      await setDoc(docRef, { ...patientData, id: patientId });
      setIsModalOpen(false);
    } catch (err) {
      console.error("Lỗi khi lưu bệnh nhân:", err);
      alert("Có lỗi xảy ra khi lưu dữ liệu!");
    }
  };

  const handleDeletePatient = async (patientId) => {
    if (!user) return;
    if (!confirm("Bạn có chắc chắn muốn xoá hồ sơ này?")) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'patients', patientId.toString());
      await deleteDoc(docRef);
      setIsModalOpen(false);
    } catch (err) {
      console.error("Lỗi khi xoá bệnh nhân:", err);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // --- MÀN HÌNH TẢI & XÁC THỰC ---
  if (authLoading) {
    return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (!user) {
    return <AuthScreen />;
  }

  // Tên hiển thị ảo (Lấy từ email ảo cắt bỏ phần @meditrack.system)
  const displayUsername = user.email ? user.email.split('@')[0] : 'Bác sĩ';

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      {/* SIDEBAR */}
      <div className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex">
        <div className="p-6">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-blue-400">
            <Activity className="w-8 h-8" />
            MediTrack
          </h1>
          <p className="text-slate-400 text-xs mt-1 flex items-center gap-1 truncate" title={displayUsername}>
             Xin chào: <span className="text-emerald-400 font-bold">{displayUsername}</span>
          </p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <button onClick={() => setActiveTab('calendar')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'calendar' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}>
            <CalendarIcon className="w-5 h-5" /> Lịch Theo Dõi
          </button>
          <button onClick={() => setActiveTab('groups')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'groups' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}>
            <Users className="w-5 h-5" /> Nhóm Bệnh
          </button>
          <button onClick={() => { setActiveTab('review'); setSelectedReviewTag(null); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'review' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}>
            <BookOpen className="w-5 h-5" /> Sổ Tay Lâm Sàng
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <button onClick={() => { setEditingPatient(null); setIsModalOpen(true); }} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors">
            <Plus className="w-5 h-5" /> Thêm Bệnh Nhân
          </button>
          <button onClick={handleLogout} className="w-full hover:bg-slate-800 text-slate-400 px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors text-sm">
            <LogOut className="w-4 h-4" /> Đăng xuất
          </button>
        </div>
      </div>

      {/* MOBILE NAV */}
      <div className="md:hidden fixed bottom-0 w-full bg-white border-t border-slate-200 flex justify-around p-2 z-10">
        <button onClick={() => setActiveTab('calendar')} className={`flex flex-col items-center p-2 ${activeTab === 'calendar' ? 'text-blue-600' : 'text-slate-500'}`}><CalendarIcon className="w-6 h-6" /><span className="text-xs mt-1">Lịch</span></button>
        <button onClick={() => setActiveTab('groups')} className={`flex flex-col items-center p-2 ${activeTab === 'groups' ? 'text-blue-600' : 'text-slate-500'}`}><Users className="w-6 h-6" /><span className="text-xs mt-1">Nhóm</span></button>
        <button onClick={() => { setActiveTab('review'); setSelectedReviewTag(null); }} className={`flex flex-col items-center p-2 ${activeTab === 'review' ? 'text-blue-600' : 'text-slate-500'}`}><BookOpen className="w-6 h-6" /><span className="text-xs mt-1">Sổ tay</span></button>
      </div>

      {/* MOBILE HEADER */}
      <div className="md:hidden fixed top-0 w-full bg-slate-900 text-white p-4 flex justify-between items-center z-10">
         <h1 className="text-xl font-bold flex items-center gap-2 text-blue-400"><Activity className="w-6 h-6" /> MediTrack</h1>
         <div className="flex gap-2">
            <button onClick={() => { setEditingPatient(null); setIsModalOpen(true); }} className="bg-emerald-500 p-2 rounded-full text-white"><Plus className="w-5 h-5" /></button>
            <button onClick={handleLogout} className="bg-slate-800 p-2 rounded-full text-slate-300"><LogOut className="w-5 h-5" /></button>
          </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-auto pt-20 md:pt-0 pb-20 md:pb-0 relative">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          
          {/* TAB 1: CALENDAR */}
          {activeTab === 'calendar' && (
            <div className="animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Lịch Quản Lý Bệnh Nhân</h2>
                <div className="flex items-center gap-4 bg-white px-2 py-1 rounded-full shadow-sm border border-slate-200">
                  <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-1 hover:bg-slate-100 rounded-full"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                  <span className="text-base font-bold text-slate-700 min-w-[100px] text-center">Tháng {currentDate.getMonth() + 1}/{currentDate.getFullYear()}</span>
                  <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-1 hover:bg-slate-100 rounded-full"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
                  {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => <div key={d} className="py-3 text-center text-sm font-semibold text-slate-500 uppercase">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-px bg-slate-200">
                  {generateCalendarDays().map((date, idx) => {
                    const activePts = date ? getActivePatientsForDate(date) : [];
                    const isToday = date && new Date().toDateString() === date.toDateString();
                    return (
                      <div key={idx} onClick={() => date && setSelectedDayPatients({ date, patients: activePts })} className={`min-h-[100px] p-2 bg-white transition-all ${date ? 'cursor-pointer hover:bg-blue-50 hover:shadow-inner' : 'bg-slate-50'} ${isToday ? 'bg-blue-50/50 ring-2 ring-inset ring-blue-400' : ''}`}>
                        {date && (
                          <>
                            <div className={`text-sm font-medium mb-1 flex justify-between items-center ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>
                              <span>{date.getDate()}</span>
                              {activePts.length > 0 && <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activePts.length}</span>}
                            </div>
                            <div className="mt-1 space-y-1">
                              {activePts.slice(0, 3).map(p => (
                                <div key={p.id} className="text-[10px] truncate text-slate-600 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded flex items-center gap-1">
                                  <div className={`w-1.5 h-1.5 rounded-full ${p.department === 'Nội' ? 'bg-blue-400' : p.department === 'Ngoại' ? 'bg-red-400' : p.department === 'Sản' ? 'bg-pink-400' : p.department === 'Nhi' ? 'bg-green-400' : 'bg-slate-400'}`}></div>
                                  {p.name.split(' ').pop()}
                                </div>
                              ))}
                              {activePts.length > 3 && <div className="text-[10px] text-slate-400 font-medium pl-1">+{activePts.length - 3} nữa</div>}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GROUPS */}
          {activeTab === 'groups' && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-2xl font-bold text-slate-800 mb-6">Quản Lý Theo Nhóm Bệnh</h2>
              <div className="space-y-8">
                {DEPARTMENTS.map(dept => {
                  const deptData = groupedPatients[dept];
                  if (!deptData) return null;

                  return (
                    <div key={dept} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="bg-slate-800 px-6 py-4 border-b flex justify-between items-center text-white">
                        <h3 className="text-xl font-bold">Khoa {dept}</h3>
                        <span className="bg-slate-700 text-sm font-bold px-3 py-1 rounded-full">{Object.values(deptData).flat().length} Bệnh nhân</span>
                      </div>
                      <div className="p-4 space-y-4">
                        {Object.entries(deptData).map(([diag, pts]) => (
                          <div key={diag} className="border border-blue-100 rounded-lg overflow-hidden">
                            <div className="bg-blue-50/50 px-4 py-2 border-b border-blue-100 flex justify-between items-center">
                              <h4 className="font-bold text-blue-900 text-sm flex items-center gap-2"><Stethoscope className="w-4 h-4 text-blue-500" /> {diag}</h4>
                              <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{pts.length}</span>
                            </div>
                            <div className="p-3 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                              {pts.map(p => (
                                <div key={p.id} onClick={() => { setEditingPatient(p); setIsModalOpen(true); }} className="p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-sm cursor-pointer transition-all">
                                  <div className="font-bold text-slate-800 flex items-center gap-1">{p.name} {p.tags && p.tags.length > 0 && <Tag className="w-3 h-3 text-amber-500" />}</div>
                                  <div className="flex justify-between items-center mt-2">
                                    <span className="text-xs text-slate-500">{p.age}t - {p.gender}</span>
                                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">{p.room}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {patients.length === 0 && <div className="text-center py-10 bg-white rounded-xl border border-slate-200 text-slate-500">Chưa có hồ sơ. Hãy thêm mới!</div>}
              </div>
            </div>
          )}

          {/* TAB 3: REVIEW / SỔ TAY */}
          {activeTab === 'review' && (
            <div className="animate-in fade-in duration-300">
              <div className="flex items-center justify-between mb-6">
                <div><h2 className="text-2xl font-bold text-slate-800">Sổ Tay Lâm Sàng</h2><p className="text-sm text-slate-500 mt-1">Ôn tập bệnh án theo các thẻ (tags)</p></div>
                {selectedReviewTag && <button onClick={() => setSelectedReviewTag(null)} className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Quay lại</button>}
              </div>

              {!selectedReviewTag ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {allUsedTags.length === 0 && <div className="col-span-full text-center py-10 bg-white rounded-xl border border-slate-200 text-slate-500">Bạn chưa đánh dấu thẻ nào.</div>}
                  {allUsedTags.map(tag => {
                    const ptsCount = patients.filter(p => p.tags && p.tags.includes(tag)).length;
                    return (
                      <div key={tag} onClick={() => setSelectedReviewTag(tag)} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 cursor-pointer transition-all group relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-amber-400 group-hover:bg-blue-500 transition-colors"></div>
                        <div className="flex justify-between items-start mb-2"><Tag className="w-6 h-6 text-slate-400 group-hover:text-blue-500" /><span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-md">{ptsCount} ca</span></div>
                        <h3 className="font-bold text-slate-800 text-lg">{tag}</h3>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4 animate-in slide-in-from-right-4">
                  <div className="bg-amber-50 border border-amber-200 px-4 py-3 rounded-lg flex items-center gap-2 mb-4"><Tag className="w-5 h-5 text-amber-600" /><span className="font-bold text-amber-900">Thẻ đang xem: {selectedReviewTag}</span></div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {patients.filter(p => p.tags && p.tags.includes(selectedReviewTag)).map(p => (
                      <div key={p.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-5">
                          <h3 className="font-bold text-lg text-blue-700 cursor-pointer hover:underline" onClick={() => { setEditingPatient(p); setIsModalOpen(true); }}>{p.currentDiagnosis || p.diagnosis || p.initialDiagnosis || "Chưa xác định"}</h3>
                          <p className="text-sm font-semibold text-slate-700 mb-2">BN: {p.name} ({p.department})</p>
                          {p.pearls && (
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                              <h4 className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><BookOpen className="w-3 h-3" /> Bài học:</h4>
                              <p className="text-sm text-slate-700 whitespace-pre-line italic">"{p.pearls}"</p>
                            </div>
                          )}
                          <button onClick={() => { setEditingPatient(p); setIsModalOpen(true); }} className="mt-4 w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold rounded-lg transition-colors">Xem Chi Tiết Bệnh Án</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* POPUP LỊCH */}
      {selectedDayPatients && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-blue-50 rounded-t-2xl">
              <h3 className="text-xl font-bold text-blue-900 flex items-center gap-2"><CalendarIcon className="w-5 h-5" /> Ngày {selectedDayPatients.date.toLocaleDateString('vi-VN')}</h3>
              <button onClick={() => setSelectedDayPatients(null)} className="p-1 hover:bg-blue-200 rounded-full transition-colors"><X className="w-6 h-6 text-blue-700" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              {selectedDayPatients.patients.length === 0 ? (
                <div className="text-center py-8 text-slate-500"><CalendarIcon className="w-12 h-12 mx-auto text-slate-300 mb-3" /><p>Không có bệnh nhân nào đang theo dõi trong ngày này.</p></div>
              ) : (
                <div className="space-y-3">
                  {selectedDayPatients.patients.map(p => (
                    <div key={p.id} onClick={() => { setEditingPatient(p); setIsModalOpen(true); }} className="flex items-center gap-4 p-4 border border-slate-200 rounded-xl bg-white hover:border-blue-400 hover:shadow-md cursor-pointer transition-all group">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${p.department === 'Nội' ? 'bg-blue-500' : p.department === 'Ngoại' ? 'bg-red-500' : p.department === 'Sản' ? 'bg-pink-500' : p.department === 'Nhi' ? 'bg-green-500' : 'bg-slate-500'}`}>{p.name.charAt(0)}</div>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors flex items-center gap-2">{p.name} {p.tags && p.tags.length > 0 && <Tag className="w-3 h-3 text-amber-500" />}</h4>
                        <div className="text-sm text-slate-500 flex items-center gap-2 mt-0.5"><span className="font-medium text-slate-700">Khoa {p.department}</span><span>•</span><span>{p.room}</span></div>
                        <p className="text-sm font-medium text-blue-600 mt-1 line-clamp-1">{p.currentDiagnosis || p.diagnosis || p.initialDiagnosis}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PATIENT MODAL */}
      {isModalOpen && <PatientModal patient={editingPatient} onClose={() => setIsModalOpen(false)} onSave={handleSavePatient} onDelete={handleDeletePatient} />}
    </div>
  );
}

// ==========================================
// COMPONENT: MÀN HÌNH ĐĂNG NHẬP (HỖ TRỢ TẠO NHIỀU TÀI KHOẢN BẰNG USERNAME)
// ==========================================
function AuthScreen() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Kiểm tra tên đăng nhập không chứa dấu cách hoặc ký tự đặc biệt
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Tên đăng nhập chỉ được chứa chữ cái không dấu, số và dấu gạch dưới (_).');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    setLoading(true);
    
    // MẸO: Tự động ghép thêm đuôi ảo để biến username thành email hợp lệ cho Firebase
    const fakeEmail = `${username.toLowerCase()}@meditrack.system`;

    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, fakeEmail, password);
      } else {
        await createUserWithEmailAndPassword(auth, fakeEmail, password);
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Tên đăng nhập hoặc mật khẩu không chính xác!');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Tên đăng nhập này đã có người sử dụng. Vui lòng chọn tên khác!');
      } else {
        setError('Lỗi kết nối hoặc hệ thống. Vui lòng thử lại sau.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">MediTrack</h1>
          <p className="text-slate-500 mt-1">
            {isLoginMode ? 'Đăng nhập vào không gian làm việc' : 'Tạo tài khoản quản lý bệnh án mới'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Tên đăng nhập (Viết liền, không dấu)</label>
            <div className="relative">
              <UserCircle className="w-5 h-5 text-slate-400 absolute left-3 top-3" />
              <input 
                type="text" required
                value={username} onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                placeholder="Ví dụ: bacsi_hoa" 
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Mật khẩu</label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-3" />
              <input 
                type="password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                placeholder="••••••••" 
              />
            </div>
          </div>
          <button 
            type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center mt-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLoginMode ? 'Đăng Nhập' : 'Đăng Ký Tài Khoản')}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600">
          {isLoginMode ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
          <button 
            type="button" 
            onClick={() => { setIsLoginMode(!isLoginMode); setError(''); setPassword(''); }}
            className="font-bold text-blue-600 hover:underline"
          >
            {isLoginMode ? "Tạo tài khoản mới" : "Đăng nhập ngay"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENT: PATIENT MODAL (BỆNH ÁN ĐIỆN TỬ) - (Giữ Nguyên Như Cũ, Chỉ Thêm Props)
// ==========================================
function PatientModal({ patient, onClose, onSave, onDelete }) {
  const normalizeImages = (imagesArray) => {
    if (!imagesArray) return [];
    return imagesArray.map(img => {
      if (typeof img === 'string') {
        return { id: Math.random().toString(36).substr(2, 9), date: new Date().toISOString().split('T')[0], type: 'Khác', base64: img, note: '' };
      }
      return img;
    });
  };

  const [formData, setFormData] = useState(patient || {
    name: "", age: "", gender: "Nam", department: "Nội", room: "", 
    admissionDate: new Date().toISOString().split('T')[0], dischargeDate: "",
    history: "", 
    dailyRecords: [], 
    images: [],
    initialDiagnosis: "", currentDiagnosis: "", clinicalReasoning: "",
    prescriptions: [],
    treatmentStrategy: "", counseling: "",
    tags: [], pearls: "",
    aiSummary: "" 
  });

  useEffect(() => {
    if (patient) {
      setFormData(prev => ({
        ...prev,
        images: normalizeImages(prev.images),
        currentDiagnosis: prev.currentDiagnosis || prev.diagnosis || "",
        aiSummary: prev.aiSummary || ""
      }));
    }
  }, [patient]);

  const [formTab, setFormTab] = useState('hanh-chinh'); 
  const [trackerMode, setTrackerMode] = useState('list'); 
  const [customTag, setCustomTag] = useState("");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const imageInputRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  // --- LOGIC DIỄN TIẾN & XÉT NGHIỆM ---
  const addDailyRecord = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const newRecord = {
      id: Date.now().toString(), date: todayStr, clinical: "",
      cbc: { wbc: '', rbc: '', hgb: '', plt: '', neu: '' },
      biochem: { glu: '', urea: '', crea: '', ast: '', alt: '', na: '', k: '', crp: '' },
      others: ""
    };
    setFormData(prev => ({ ...prev, dailyRecords: [newRecord, ...(prev.dailyRecords || [])] }));
  };

  const updateDailyRecord = (recordId, category, field, value) => {
    setFormData(prev => ({
      ...prev,
      dailyRecords: prev.dailyRecords.map(r => {
        if (r.id === recordId) {
          if (category === 'root') return { ...r, [field]: value };
          return { ...r, [category]: { ...r[category], [field]: value } };
        }
        return r;
      })
    }));
  };

  const deleteDailyRecord = (recordId) => {
    if(confirm("Xoá ngày theo dõi này?")) {
      setFormData(prev => ({ ...prev, dailyRecords: prev.dailyRecords.filter(r => r.id !== recordId) }));
    }
  };

  // --- LOGIC HÌNH ẢNH CÓ GHI CHÚ ---
  const compressImage = (dataUrl) => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX_WIDTH = 1200;
        let width = img.width; let height = img.height;
        if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
        canvas.width = width; canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = dataUrl;
    });
  };

  const processFile = async (file) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const compressed = await compressImage(event.target.result);
      const newImageObj = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        date: new Date().toISOString().split('T')[0],
        type: 'X-Quang / Siêu Âm', 
        base64: compressed,
        note: ''
      };
      setFormData(prev => ({ ...prev, images: [newImageObj, ...(prev.images || [])] }));
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e) => Array.from(e.target.files).forEach(processFile);
  const handlePaste = (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) if (items[index].kind === 'file') processFile(items[index].getAsFile());
  };
  const removeImage = (id) => setFormData(prev => ({ ...prev, images: prev.images.filter(img => img.id !== id) }));
  const updateImageField = (id, field, value) => {
    setFormData(prev => ({ ...prev, images: prev.images.map(img => img.id === id ? { ...img, [field]: value } : img) }));
  };

  // --- LOGIC KÊ ĐƠN THUỐC THEO NGÀY (Rx Timeline) ---
  const addPrescriptionToDate = (startDate) => {
    const newDrug = { 
      id: Date.now().toString(), 
      startDate: startDate, 
      name: '', dosage: '', route: 'Uống', freq: '', days: '', note: '' 
    };
    setFormData(prev => ({ ...prev, prescriptions: [...(prev.prescriptions || []), newDrug] }));
  };

  const updatePrescription = (id, field, value) => {
    setFormData(prev => ({ ...prev, prescriptions: prev.prescriptions.map(d => d.id === id ? { ...d, [field]: value } : d) }));
  };

  const removePrescription = (id) => {
    setFormData(prev => ({ ...prev, prescriptions: prev.prescriptions.filter(d => d.id !== id) }));
  };

  const updateGroupDate = (oldDate, newDate) => {
    setFormData(prev => ({
      ...prev,
      prescriptions: prev.prescriptions.map(rx => (rx.startDate || formData.admissionDate) === oldDate ? { ...rx, startDate: newDate } : rx)
    }));
  };

  // Logic Thẻ (Tags)
  const toggleTag = (tag) => {
    setFormData(prev => {
      const tags = prev.tags || [];
      return tags.includes(tag) ? { ...prev, tags: tags.filter(t => t !== tag) } : { ...prev, tags: [...tags, tag] };
    });
  };
  const addCustomTag = (e) => {
    e.preventDefault();
    if (customTag.trim() && !(formData.tags || []).includes(customTag.trim())) {
      toggleTag(customTag.trim()); setCustomTag("");
    }
  };

  // --- LOGIC TẠO TÓM TẮT BẰNG AI ---
  const generateAISummary = async () => {
    setIsGeneratingAI(true);
    const apiKey = ""; 
    
    const rxStr = (formData.prescriptions || []).map(p => `- ${p.startDate || ''}: ${p.name} ${p.dosage} ${p.route} (${p.days ? p.days+' ngày' : ''})`).join('\n');
    const recordsStr = (formData.dailyRecords || []).map(r => `Ngày ${r.date}: Lâm sàng: ${r.clinical}. XN CTM: WBC ${r.cbc.wbc}, RBC ${r.cbc.rbc}, HGB ${r.cbc.hgb}, PLT ${r.cbc.plt}. Sinh hoá: Glu ${r.biochem.glu}, Urea ${r.biochem.urea}, Crea ${r.biochem.crea}, AST/ALT ${r.biochem.ast}/${r.biochem.alt}. Khác: ${r.others}`).join('\n');
    
    const prompt = `Bạn là một bác sĩ chuyên khoa giàu kinh nghiệm. Hãy viết "Tóm tắt bệnh án" chuyên nghiệp cho bệnh nhân sau để phục vụ sinh viên y khoa làm hồ sơ, giao ban hoặc hội chẩn:

    *Thông tin bệnh nhân cung cấp:*
    - Hành chính: ${formData.name}, ${formData.age} tuổi, giới tính ${formData.gender}. Ngày NV: ${formData.admissionDate}.
    - Bệnh sử & Lý do NV: ${formData.history}
    - Diễn tiến & Cận lâm sàng nổi bật qua các ngày: \n${recordsStr}
    - Chẩn đoán sơ bộ ban đầu: ${formData.initialDiagnosis}
    - Chẩn đoán hiện tại/xác định: ${formData.currentDiagnosis}
    - Y lệnh/Điều trị: \n${rxStr}

    *Yêu cầu định dạng tóm tắt:*
    1. Câu mở đầu chuẩn (Bệnh nhân [Giới], [Tuổi] tuổi, nhập viện ngày... với lý do...).
    2. Tóm tắt các hội chứng/triệu chứng lâm sàng chính (gộp lại súc tích).
    3. Tóm tắt Cận lâm sàng bất thường có giá trị biện luận chẩn đoán.
    4. Ghi rõ chẩn đoán xác định và các phương pháp điều trị, thuốc chính đã sử dụng.
    Văn phong y khoa, chuyên nghiệp, rõ ràng, chia đoạn dễ đọc. Đừng dùng markdown in đậm quá đà, giữ cho nó giống một đoạn văn bản tóm tắt thật.`;

    let retries = 5;
    let delay = 1000;
    while (retries > 0) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        setFormData(prev => ({ ...prev, aiSummary: text }));
        setIsGeneratingAI(false);
        return;
      } catch (e) {
        retries--;
        if (retries === 0) {
          alert("Lỗi khi kết nối với AI. Vui lòng thử lại sau.");
          setIsGeneratingAI(false);
        } else {
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
        }
      }
    }
  };

  const submitSave = async () => {
    setIsSaving(true);
    await onSave(formData);
    setIsSaving(false);
  };

  const sortedDailyRecords = [...(formData.dailyRecords || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Nhóm Đơn Thuốc theo ngày
  const groupedRx = (formData.prescriptions || []).reduce((acc, rx) => {
    const dateKey = rx.startDate || formData.admissionDate || new Date().toISOString().split('T')[0];
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(rx);
    return acc;
  }, {});
  const sortedRxDates = Object.keys(groupedRx).sort((a,b) => new Date(a) - new Date(b));

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header Modal */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 flex-shrink-0">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            {patient ? 'Chỉnh Sửa Hồ Sơ' : 'Thêm Bệnh Nhân Mới'}
            {patient && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-semibold ml-2">ID: {patient.id.toString().slice(-4)}</span>}
          </h2>
          <div className="flex items-center gap-2">
            {patient && <button onClick={() => onDelete(patient.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors" title="Xoá bệnh nhân"><LogOut className="w-5 h-5" /></button>}
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"><X className="w-6 h-6" /></button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-2 sm:px-6 border-b border-slate-200 bg-white overflow-x-auto hide-scrollbar flex-shrink-0">
          {[
            { id: 'hanh-chinh', label: 'Hành Chính', icon: FileText },
            { id: 'dien-tien', label: 'Diễn Tiến & XN', icon: Activity },
            { id: 'hinh-anh', label: 'Hình Ảnh CLS', icon: ImageIcon },
            { id: 'dieu-tri', label: 'CĐ & Kê Đơn (Rx)', icon: Stethoscope },
            { id: 'tom-tat', label: 'Tóm Tắt Bệnh Án', icon: Sparkles },
            { id: 'on-tap', label: 'Đánh Giá & Bài Học', icon: Star },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFormTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 font-semibold text-sm whitespace-nowrap border-b-2 transition-colors ${
                formTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${tab.id === 'tom-tat' && formTab !== 'tom-tat' ? 'text-amber-500' : ''}`} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          
          {/* TAB 1: Hành chính */}
          {formTab === 'hanh-chinh' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Họ và tên <span className="text-red-500">*</span></label>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nhập tên BN" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Tuổi</label>
                  <input type="number" name="age" value={formData.age} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Giới tính</label>
                  <select name="gender" value={formData.gender} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    <option>Nam</option><option>Nữ</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Khoa <span className="text-red-500">*</span></label>
                  <select name="department" value={formData.department} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-700 bg-blue-50">
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Số phòng/Giường</label>
                  <input type="text" name="room" value={formData.room} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="VD: P201" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Ngày NV</label>
                  <input type="date" name="admissionDate" value={formData.admissionDate} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Ngày XV (Dự kiến)</label>
                  <input type="date" name="dischargeDate" value={formData.dischargeDate} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Bệnh sử & Lý do vào viện</label>
                <textarea name="history" value={formData.history} onChange={handleChange} rows="3" className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y" placeholder="Bệnh nhân kể lại quá trình khởi phát bệnh, triệu chứng ban đầu..."></textarea>
              </div>
            </div>
          )}

          {/* TAB 2: DIỄN TIẾN & XÉT NGHIỆM */}
          {formTab === 'dien-tien' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <button onClick={addDailyRecord} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 text-sm transition-colors">
                  <Plus className="w-4 h-4" /> Thêm Ngày Theo Dõi
                </button>
                <div className="flex bg-slate-200 p-1 rounded-lg">
                  <button onClick={() => setTrackerMode('list')} className={`px-4 py-1.5 rounded-md text-sm font-semibold flex items-center gap-2 transition-all ${trackerMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:text-slate-800'}`}>
                    <ListIcon className="w-4 h-4" /> Nhập Liệu
                  </button>
                  <button onClick={() => setTrackerMode('table')} className={`px-4 py-1.5 rounded-md text-sm font-semibold flex items-center gap-2 transition-all ${trackerMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:text-slate-800'}`}>
                    <TableIcon className="w-4 h-4" /> Bảng Tổng Hợp
                  </button>
                </div>
              </div>

              {trackerMode === 'list' && (
                <div className="space-y-6">
                  {(formData.dailyRecords || []).length === 0 ? (
                    <div className="text-center py-10 bg-white rounded-xl border border-slate-200 text-slate-500 border-dashed">Chưa có ngày theo dõi nào. Hãy bấm "Thêm Ngày Theo Dõi".</div>
                  ) : (
                    (formData.dailyRecords || []).map((record) => (
                      <div key={record.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
                        <div className="bg-blue-50 border-b border-blue-100 px-4 py-3 flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <CalendarIcon className="w-5 h-5 text-blue-500" />
                            <input type="date" value={record.date} onChange={(e) => updateDailyRecord(record.id, 'root', 'date', e.target.value)} className="font-bold text-blue-900 bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-300 rounded px-2 py-1" />
                          </div>
                          <button onClick={() => deleteDailyRecord(record.id)} className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>
                        </div>
                        <div className="p-4 space-y-5">
                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Tình trạng lâm sàng (Diễn tiến)</label>
                            <textarea value={record.clinical} onChange={(e) => updateDailyRecord(record.id, 'root', 'clinical', e.target.value)} className="w-full p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y min-h-[80px]" placeholder="Ghi nhận triệu chứng, sinh hiệu (HA, Mạch, Nhiệt độ...)" />
                          </div>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-red-50/30 border border-red-100 p-4 rounded-xl">
                              <h4 className="text-sm font-bold text-red-800 mb-3 flex items-center gap-2">🩸 Công Thức Máu</h4>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {CBC_FIELDS.map(field => (
                                  <div key={field.key}>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">{field.label}</label>
                                    <div className="relative">
                                      <input type="text" value={record.cbc?.[field.key] || ''} onChange={(e) => updateDailyRecord(record.id, 'cbc', field.key, e.target.value)} className="w-full p-2 text-sm border border-slate-300 rounded focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none pr-8" />
                                      <span className="absolute right-2 top-2 text-[10px] text-slate-400">{field.unit}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="bg-blue-50/30 border border-blue-100 p-4 rounded-xl">
                              <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">🧪 Sinh Hoá Máu</h4>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {BIOCHEM_FIELDS.map(field => (
                                  <div key={field.key}>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">{field.label}</label>
                                    <div className="relative">
                                      <input type="text" value={record.biochem?.[field.key] || ''} onChange={(e) => updateDailyRecord(record.id, 'biochem', field.key, e.target.value)} className="w-full p-2 text-sm border border-slate-300 rounded focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none pr-8" />
                                      <span className="absolute right-2 top-2 text-[10px] text-slate-400">{field.unit}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Kết quả khác (Nước tiểu, Khí máu, Cấy VS...)</label>
                            <textarea value={record.others} onChange={(e) => updateDailyRecord(record.id, 'root', 'others', e.target.value)} className="w-full p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y font-mono min-h-[80px]" placeholder="10 TSNT: PRO (-), LEU (+)..." />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {trackerMode === 'table' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
                  {sortedDailyRecords.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">Chưa có dữ liệu để hiển thị bảng.</div>
                  ) : (
                    <div className="overflow-x-auto hide-scrollbar">
                      <table className="w-full text-sm text-left border-collapse min-w-[600px]">
                        <thead>
                          <tr className="bg-slate-800 text-white">
                            <th className="border-b border-r border-slate-700 p-3 min-w-[150px] font-bold top-0 sticky left-0 z-10 bg-slate-800 shadow-[1px_0_0_#334155]">Chỉ số theo dõi</th>
                            {sortedDailyRecords.map(r => <th key={`head-${r.id}`} className="border-b border-slate-700 p-3 min-w-[180px] text-center font-bold">{new Date(r.date).toLocaleDateString('vi-VN')}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border-b border-r border-slate-200 p-3 font-bold bg-slate-50 sticky left-0 z-10 shadow-[1px_0_0_#e2e8f0]">Diễn tiến lâm sàng</td>
                            {sortedDailyRecords.map(r => <td key={`clin-${r.id}`} className="border-b border-slate-200 p-3 whitespace-pre-wrap align-top text-xs leading-relaxed text-slate-700">{r.clinical || '-'}</td>)}
                          </tr>
                          <tr><td colSpan={sortedDailyRecords.length + 1} className="bg-red-50 text-red-800 font-bold p-2 text-xs uppercase tracking-wider">Công Thức Máu</td></tr>
                          {CBC_FIELDS.map(field => (
                            <tr key={`tr-cbc-${field.key}`} className="hover:bg-slate-50">
                              <td className="border-b border-r border-slate-200 px-3 py-2 font-semibold text-slate-600 text-xs sticky left-0 z-10 bg-white hover:bg-slate-50 shadow-[1px_0_0_#e2e8f0]">{field.label} <span className="text-[9px] font-normal text-slate-400">({field.unit})</span></td>
                              {sortedDailyRecords.map(r => <td key={`cbc-${r.id}-${field.key}`} className="border-b border-slate-200 px-3 py-2 text-center font-mono text-sm">{r.cbc?.[field.key] ? <span className="bg-slate-100 px-2 py-0.5 rounded">{r.cbc[field.key]}</span> : '-'}</td>)}
                            </tr>
                          ))}
                          <tr><td colSpan={sortedDailyRecords.length + 1} className="bg-blue-50 text-blue-800 font-bold p-2 text-xs uppercase tracking-wider">Sinh Hoá Máu</td></tr>
                          {BIOCHEM_FIELDS.map(field => (
                            <tr key={`tr-bio-${field.key}`} className="hover:bg-slate-50">
                              <td className="border-b border-r border-slate-200 px-3 py-2 font-semibold text-slate-600 text-xs sticky left-0 z-10 bg-white hover:bg-slate-50 shadow-[1px_0_0_#e2e8f0]">{field.label} <span className="text-[9px] font-normal text-slate-400">({field.unit})</span></td>
                              {sortedDailyRecords.map(r => <td key={`bio-${r.id}-${field.key}`} className="border-b border-slate-200 px-3 py-2 text-center font-mono text-sm">{r.biochem?.[field.key] ? <span className="bg-slate-100 px-2 py-0.5 rounded">{r.biochem[field.key]}</span> : '-'}</td>)}
                            </tr>
                          ))}
                          <tr><td colSpan={sortedDailyRecords.length + 1} className="bg-slate-100 text-slate-800 font-bold p-2 text-xs uppercase tracking-wider">Khác</td></tr>
                          <tr>
                            <td className="border-b border-r border-slate-200 p-3 font-semibold text-slate-600 text-xs bg-slate-50 sticky left-0 z-10 shadow-[1px_0_0_#e2e8f0]">Ghi chú</td>
                            {sortedDailyRecords.map(r => <td key={`oth-${r.id}`} className="border-b border-slate-200 p-3 whitespace-pre-wrap align-top text-xs font-mono text-slate-600">{r.others || '-'}</td>)}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: HÌNH ẢNH CLS */}
          {formTab === 'hinh-anh' && (
            <div className="space-y-4">
               <div>
                <div 
                  className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-blue-50/50 hover:bg-blue-50 transition-colors cursor-pointer mb-6"
                  onPaste={handlePaste}
                  onClick={() => imageInputRef.current?.click()}
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <ImageIcon className="w-6 h-6 text-blue-600" />
                  </div>
                  <p className="text-slate-800 font-bold">Click để tải lên hoặc dán (Ctrl+V) kết quả CLS</p>
                  <p className="text-slate-500 text-sm mt-1">Hỗ trợ X-Quang, Siêu âm, ECG, Giấy XN...</p>
                  <input type="file" multiple accept="image/*" className="hidden" ref={imageInputRef} onChange={handleImageUpload} />
                </div>

                {formData.images && formData.images.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {formData.images.map((img) => (
                      <div key={img.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="relative h-48 bg-slate-900 group">
                          <img src={img.base64} alt="CLS" className="w-full h-full object-contain" />
                          <button onClick={() => removeImage(img.id)} className="absolute top-2 right-2 p-1.5 bg-red-500/90 hover:bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-md">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col gap-2 flex-1">
                          <div className="flex gap-2">
                            <input 
                              type="date" 
                              value={img.date} 
                              onChange={(e) => updateImageField(img.id, 'date', e.target.value)} 
                              className="text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                            <input 
                              type="text" 
                              value={img.type} 
                              placeholder="Loại CLS..."
                              onChange={(e) => updateImageField(img.id, 'type', e.target.value)} 
                              className="flex-1 text-xs p-1.5 border border-slate-300 rounded font-semibold focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <textarea 
                            value={img.note} 
                            onChange={(e) => updateImageField(img.id, 'note', e.target.value)}
                            placeholder="Nhập ghi chú / Kết quả đọc (VD: Bóng tim to, mờ góc sườn hoành...)"
                            className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none flex-1 min-h-[60px] resize-y"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 border border-slate-200 rounded-xl bg-white">Chưa có hình ảnh cận lâm sàng nào.</div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: CHẨN ĐOÁN & KÊ ĐƠN (NHÓM THEO NGÀY) */}
          {formTab === 'dieu-tri' && (
            <div className="space-y-8 animate-in fade-in">
              {/* SECTION: CHẨN ĐOÁN & BIỆN LUẬN */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 border-b pb-2 flex items-center gap-2"><FileQuestion className="w-5 h-5 text-blue-600"/> Tiến Trình Chẩn Đoán</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Chẩn đoán Sơ bộ (Lúc NV)</label>
                    <textarea name="initialDiagnosis" value={formData.initialDiagnosis} onChange={handleChange} rows="2" className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y" placeholder="VD: Theo dõi Viêm tụy cấp"></textarea>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-red-600 uppercase mb-1">Chẩn đoán Hiện tại / Xác định</label>
                    <textarea name="currentDiagnosis" value={formData.currentDiagnosis} onChange={handleChange} rows="2" className="w-full p-2 text-sm border-2 border-red-200 bg-red-50 rounded-lg focus:ring-2 focus:ring-red-500 outline-none font-bold text-red-900 resize-y" placeholder="VD: Viêm tụy cấp thể phù nề do sỏi bùn túi mật"></textarea>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Biện luận lâm sàng (Tại sao lại chẩn đoán như vậy?)</label>
                  <textarea name="clinicalReasoning" value={formData.clinicalReasoning} onChange={handleChange} rows="3" className="w-full p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y bg-slate-50" placeholder="Ghi nhận sự thay đổi chẩn đoán dựa trên kết quả CLS hoặc diễn tiến mới..."></textarea>
                </div>
              </div>

              {/* SECTION: Y Lệnh (Rx) THEO NGÀY */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-800 px-5 py-3 flex justify-between items-center text-white">
                  <h3 className="font-bold flex items-center gap-2"><Syringe className="w-5 h-5 text-emerald-400"/> Tờ Y Lệnh / Đơn Thuốc Theo Ngày (Rx)</h3>
                  <button onClick={() => addPrescriptionToDate(formData.admissionDate || new Date().toISOString().split('T')[0])} className="bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-1">
                    <Plus className="w-4 h-4" /> Thêm Y Lệnh Mới
                  </button>
                </div>

                <div className="p-4 space-y-6">
                  {sortedRxDates.length === 0 ? (
                    <p className="text-sm text-slate-500 italic text-center py-4">Chưa có y lệnh thuốc. Bấm "Thêm Y Lệnh Mới" để kê đơn theo ngày.</p>
                  ) : (
                    sortedRxDates.map(dateKey => (
                      <div key={dateKey} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2 flex justify-between items-center">
                          <h4 className="font-bold text-emerald-800 flex items-center gap-2 text-sm">
                            Y Lệnh Ngày: 
                            <input 
                              type="date" 
                              value={dateKey} 
                              onChange={(e) => updateGroupDate(dateKey, e.target.value)} 
                              className="bg-white border border-emerald-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-emerald-400" 
                            />
                          </h4>
                          <button onClick={() => addPrescriptionToDate(dateKey)} className="text-emerald-700 hover:bg-emerald-200 text-xs font-bold px-2 py-1 rounded transition-colors">+ Thêm thuốc</button>
                        </div>
                        
                        <div className="p-3 bg-slate-50 space-y-2">
                           <div className="hidden md:grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-500 uppercase px-2">
                            <div className="col-span-3">Tên thuốc</div>
                            <div className="col-span-2">Hàm lượng</div>
                            <div className="col-span-2">Đường dùng</div>
                            <div className="col-span-2">Cách dùng / Tốc độ</div>
                            <div className="col-span-2">Số ngày dùng / Hẹn</div>
                            <div className="col-span-1"></div>
                          </div>
                          
                          {groupedRx[dateKey].map((rx, idx) => (
                            <div key={rx.id} className="flex flex-col md:grid md:grid-cols-12 gap-2 bg-white p-3 md:p-1.5 rounded-lg border border-slate-200 items-start md:items-center relative hover:border-blue-300 transition-colors">
                              <span className="md:hidden absolute top-2 right-2 text-xs font-bold text-slate-400">#{idx + 1}</span>
                              <div className="w-full md:col-span-3"><input type="text" placeholder="Tên thuốc (VD: Paracetamol)" value={rx.name} onChange={(e) => updatePrescription(rx.id, 'name', e.target.value)} className="w-full p-1.5 text-sm border border-transparent hover:border-slate-300 focus:border-slate-300 focus:ring-1 focus:ring-blue-500 rounded font-semibold text-blue-900 outline-none" /></div>
                              <div className="w-full md:col-span-2 flex items-center gap-2 md:block"><span className="md:hidden text-xs w-20">Hàm lượng:</span><input type="text" placeholder="VD: 1g/100ml" value={rx.dosage} onChange={(e) => updatePrescription(rx.id, 'dosage', e.target.value)} className="w-full p-1.5 text-sm border border-transparent hover:border-slate-300 focus:border-slate-300 focus:ring-1 focus:ring-blue-500 rounded outline-none" /></div>
                              <div className="w-full md:col-span-2 flex items-center gap-2 md:block">
                                <span className="md:hidden text-xs w-20">Đường dùng:</span>
                                <select value={rx.route} onChange={(e) => updatePrescription(rx.id, 'route', e.target.value)} className="w-full p-1.5 text-sm border border-transparent hover:border-slate-300 focus:border-slate-300 focus:ring-1 focus:ring-blue-500 rounded bg-transparent outline-none cursor-pointer">
                                  <option>Uống</option><option>Tiêm TM (TMC)</option><option>Truyền TM (TTM)</option><option>Tiêm bắp (TB)</option><option>Tiêm Dưới Da</option><option>Khác</option>
                                </select>
                              </div>
                              <div className="w-full md:col-span-2 flex items-center gap-2 md:block"><span className="md:hidden text-xs w-20">Cách dùng:</span><input type="text" placeholder="VD: XXX giọt/ph" value={rx.freq} onChange={(e) => updatePrescription(rx.id, 'freq', e.target.value)} className="w-full p-1.5 text-sm border border-transparent hover:border-slate-300 focus:border-slate-300 focus:ring-1 focus:ring-blue-500 rounded outline-none" /></div>
                              <div className="w-full md:col-span-2 flex items-center gap-2 md:block"><span className="md:hidden text-xs w-20">Số ngày:</span><input type="text" placeholder="VD: 5 ngày" value={rx.days} onChange={(e) => updatePrescription(rx.id, 'days', e.target.value)} className="w-full p-1.5 text-sm border border-transparent hover:border-slate-300 focus:border-slate-300 focus:ring-1 focus:ring-blue-500 rounded outline-none text-emerald-700 font-semibold" /></div>
                              <div className="w-full md:col-span-1 flex justify-end md:justify-center mt-2 md:mt-0">
                                <button onClick={() => removePrescription(rx.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"><Trash2 className="w-4 h-4"/></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: TÓM TẮT BỆNH ÁN BẰNG AI */}
          {formTab === 'tom-tat' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                      <Sparkles className="w-6 h-6 text-amber-500" /> AI Tóm Tắt Bệnh Án
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">Hệ thống tự động tổng hợp thông tin, chẩn đoán và y lệnh để tạo bệnh án tóm tắt.</p>
                  </div>
                  <button 
                    onClick={generateAISummary}
                    disabled={isGeneratingAI}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md flex items-center gap-2 disabled:bg-blue-400"
                  >
                    {isGeneratingAI ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bot className="w-5 h-5" />}
                    {isGeneratingAI ? 'AI Đang Tổng Hợp...' : 'Tự Động Tạo Tóm Tắt'}
                  </button>
                </div>

                <div className="bg-white rounded-xl border border-blue-100 shadow-inner overflow-hidden relative">
                  {isGeneratingAI && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10">
                      <div className="flex flex-col items-center gap-2">
                         <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                         <span className="text-sm font-bold text-blue-800 animate-pulse">Đang phân tích bệnh án...</span>
                      </div>
                    </div>
                  )}
                  <textarea 
                    value={formData.aiSummary}
                    onChange={(e) => setFormData(prev => ({ ...prev, aiSummary: e.target.value }))}
                    placeholder="Bấm 'Tự Động Tạo Tóm Tắt' để AI viết tóm tắt dựa trên các dữ liệu bạn đã nhập. Bạn có thể tự do chỉnh sửa văn bản này sau khi AI tạo xong."
                    className="w-full h-[400px] p-5 text-sm leading-relaxed text-slate-800 focus:outline-none resize-y"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-3 text-right">* Bản tóm tắt này có thể copy ra ngoài để làm báo cáo giao ban hoặc in bệnh án.</p>
              </div>
            </div>
          )}

          {/* TAB 6: Bài Học & Đánh giá */}
          {formTab === 'on-tap' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <label className="block text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><Tag className="w-5 h-5 text-blue-600" /> Phân loại Thẻ (Tags)</label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {PREDEFINED_TAGS.map(tag => {
                    const isActive = (formData.tags || []).includes(tag);
                    return (
                      <button key={tag} onClick={() => toggleTag(tag)} className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${isActive ? 'bg-blue-100 border-blue-400 text-blue-800 shadow-sm' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>{tag}</button>
                    );
                  })}
                  {(formData.tags || []).filter(t => !PREDEFINED_TAGS.includes(t)).map(tag => (
                      <button key={tag} onClick={() => toggleTag(tag)} className="px-3 py-1.5 rounded-full text-sm font-semibold border bg-purple-100 border-purple-400 text-purple-800 shadow-sm transition-all">{tag} <X className="w-3 h-3 inline ml-1" /></button>
                  ))}
                </div>
                <form onSubmit={addCustomTag} className="flex gap-2 max-w-sm">
                  <input type="text" value={customTag} onChange={(e) => setCustomTag(e.target.value)} placeholder="Thêm thẻ khác (VD: Báo cáo giao ban)..." className="flex-1 p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500" />
                  <button type="submit" className="bg-slate-800 text-white px-3 rounded-lg text-sm font-semibold hover:bg-slate-700">Thêm</button>
                </form>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2"><BookOpen className="w-5 h-5 text-amber-600" /> Bài học lâm sàng (Clinical Pearls)</label>
                <textarea name="pearls" value={formData.pearls} onChange={handleChange} rows="6" className="w-full p-4 border border-amber-200 bg-amber-50/50 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none resize-y placeholder-amber-300 text-amber-900" placeholder="Ghi chú lại những sai lầm cần tránh, dấu hiệu đặc biệt mà bạn học được từ ca này..."></textarea>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 sm:px-5 py-2.5 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 transition-colors">Hủy bỏ</button>
          <button onClick={submitSave} disabled={!formData.name || isSaving} className="px-4 sm:px-5 py-2.5 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white flex items-center gap-2 transition-colors">
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} {patient ? 'Lưu Cập Nhật' : 'Tạo Hồ Sơ'}
          </button>
        </div>
      </div>
    </div>
  );
}