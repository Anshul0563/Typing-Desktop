import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowDownAZ, Filter, Keyboard, Search, X } from 'lucide-react';
import { api } from '../services/api.js';
import { Loader } from '../components/Loader.jsx';
import { Notice } from '../components/Toast.jsx';
import { ExamCard } from '../components/dashboard/ExamCard.jsx';

export default function Exams() {
  const navigate = useNavigate(); const location = useLocation(); const [exams, setExams] = useState([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [category, setCategory] = useState('All'); const [language, setLanguage] = useState('All'); const [sort, setSort] = useState('recommended');
  const query = new URLSearchParams(location.search).get('q')?.trim().toLowerCase() || '';
  const updateSearch = (value) => navigate({ pathname: '/exams', search: value.trim() ? `?q=${encodeURIComponent(value)}` : '' }, { replace: true });
  useEffect(() => { api('/exams').then((data) => setExams(data.exams)).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  const categories = useMemo(() => ['All', ...new Set(exams.map((exam) => exam.category || 'Practice'))], [exams]);
  const languages = useMemo(() => ['All', ...new Set(exams.map((exam) => exam.language).filter(Boolean))], [exams]);
  const filtered = useMemo(() => {
    const values = exams.filter((exam) => (!query || [exam.name, exam.organization, exam.category, exam.language, exam.description].some((value) => String(value || '').toLowerCase().includes(query))) && (category === 'All' || (exam.category || 'Practice') === category) && (language === 'All' || exam.language === language));
    if (sort === 'name') return [...values].sort((left, right) => left.name.localeCompare(right.name));
    if (sort === 'duration') return [...values].sort((left, right) => left.durationMinutes - right.durationMinutes);
    return values;
  }, [category, exams, language, query, sort]);
  const hasFilters = Boolean(query || category !== 'All' || language !== 'All' || sort !== 'recommended');
  const clearFilters = () => { updateSearch(''); setCategory('All'); setLanguage('All'); setSort('recommended'); };
  if (loading) return <Loader label="Loading typing tests…" />;
  return <><div className="student-page-title exams-page-title"><div><span>Test catalogue</span><h1>Find the right practice</h1><p>Filter by exam type and language, then start exactly where your preparation needs work.</p></div><span className="exam-count">{filtered.length} of {exams.length}</span></div><section className="exam-discovery-bar" aria-label="Filter typing tests"><label className="catalogue-search"><Search /><input aria-label="Search typing tests" placeholder="Search exam or organization…" value={new URLSearchParams(location.search).get('q') || ''} onChange={(event) => updateSearch(event.target.value)} /></label><div className="exam-filter-selects"><label><Filter /><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label><label><Keyboard /><span>Language</span><select value={language} onChange={(event) => setLanguage(event.target.value)}>{languages.map((value) => <option key={value}>{value}</option>)}</select></label><label><ArrowDownAZ /><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recommended">Recommended</option><option value="name">Name A–Z</option><option value="duration">Shortest first</option></select></label></div>{hasFilters && <button className="clear-exam-filters" onClick={clearFilters}><X />Clear</button>}</section><div className="active-filter-row"><strong>{filtered.length} test{filtered.length === 1 ? '' : 's'} ready</strong><div>{category !== 'All' && <span>{category}<button onClick={() => setCategory('All')} aria-label="Remove category filter"><X /></button></span>}{language !== 'All' && <span>{language}<button onClick={() => setLanguage('All')} aria-label="Remove language filter"><X /></button></span>}</div></div><Notice>{error}</Notice>{filtered.length ? <div className="student-exam-grid exams-catalogue-grid">{filtered.map((exam) => <ExamCard key={exam._id} exam={exam} onStart={() => navigate(`/test/${exam._id}`)} />)}</div> : <section className="results-empty compact-empty"><Keyboard /><h2>{exams.length ? 'No tests match these filters' : 'No active exams'}</h2><p>{exams.length ? 'Clear one or more filters to discover other available tests.' : 'Your administrator is preparing new tests. Please check again shortly.'}</p>{hasFilters && <button className="button button-primary" onClick={clearFilters}>Reset all filters</button>}</section>}</>;
}
