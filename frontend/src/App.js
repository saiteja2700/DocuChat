import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const WEATHER_API_KEY = 'YOUR_OPENWEATHERMAP_API_KEY'; // <-- Replace with your key

function RAGUI() {
  // Theme state
  const [darkMode, setDarkMode] = useState(true);

  // State for PDF upload
  const [pdfFile, setPdfFile] = useState(null);
  const [uploadedFilename, setUploadedFilename] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploading, setUploading] = useState(false);

  // State for processing
  const [processing, setProcessing] = useState(false);
  const [ready, setReady] = useState(false);

  // State for Q&A
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [qaLoading, setQaLoading] = useState(false);
  // Remove showHistory state and drag logic for history panel
  const [showWelcome, setShowWelcome] = useState(true);
  const [userInfo, setUserInfo] = useState({ city: '', country: '', temp: '', time: '', timezone: '', error: '' });
  const [didYouKnow, setDidYouKnow] = useState('');
  const [timeNow, setTimeNow] = useState('');
  const confettiRef = useRef(null);
  const [lastQuestion, setLastQuestion] = useState("");
  const [qaHistory, setQaHistory] = useState([]);
  const [importantPoints, setImportantPoints] = useState([]);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [showPointsPanel, setShowPointsPanel] = useState(true);

  // Show welcome overlay, then fade out after 5 seconds
  useEffect(() => {
    if (showWelcome) {
      setTimeout(() => {
        setShowWelcome(false);
      }, 3000);
    }
  }, [showWelcome]);

  // Animate main page in after welcome screen
  const [mainVisible, setMainVisible] = useState(false);
  useEffect(() => {
    if (!showWelcome) {
      setTimeout(() => setMainVisible(true), 50);
    } else {
      setMainVisible(false);
    }
  }, [showWelcome]);

  // Backend base URL - Update this when deploying
  const BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

  // Handle PDF file selection
  const handleFileChange = (e) => {
    setPdfFile(e.target.files[0]);
    setUploadedFilename('');
    setUploadMessage('');
    setAnswer('');
    setReady(false);
  };

  // On mount, fetch user location and weather
  useEffect(() => {
    async function fetchInfo() {
      try {
        const geoRes = await fetch('https://ipapi.co/json/');
        const geo = await geoRes.json();
        let temp = '';
        if (geo.city && geo.country && geo.latitude && geo.longitude) {
          try {
            const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${geo.latitude}&lon=${geo.longitude}&appid=${WEATHER_API_KEY}&units=metric`);
            const weather = await weatherRes.json();
            temp = weather.main ? `${Math.round(weather.main.temp)}°C` : '';
          } catch {}
        }
        setUserInfo({
          city: geo.city || '',
          country: geo.country_name || '',
          temp,
          time: '',
          timezone: geo.timezone || '',
          error: '',
        });
      } catch {
        setUserInfo(u => ({ ...u, error: 'Could not fetch location.' }));
      }
    }
    fetchInfo();
  }, []);

  // Update local time every second
  useEffect(() => {
    let timer;
    if (userInfo.timezone) {
      timer = setInterval(() => {
        const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: userInfo.timezone });
        setTimeNow(now);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [userInfo.timezone]);

  // Onboarding: confetti on first upload and onboarding-aware handleAsk
  const handleUpload = async () => {
    if (!pdfFile) {
      toast.error('Please select a PDF file.');
      setUploadMessage('Please select a PDF file.');
      return;
    }
    setUploading(true);
    setProcessing(false);
    setReady(false);
    setUploadMessage('Uploading...');
    setAnswer('');
    const formData = new FormData();
    formData.append('file', pdfFile);
    try {
      const res = await axios.post(`${BASE_URL}/upload-pdf/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadedFilename(res.data.filename);
      setUploadMessage('Processing PDF...');
      setUploading(false);
      toast.info('PDF uploaded! Processing...');
      setProcessing(true);
      await handleProcess(res.data.filename);
    } catch (err) {
      setUploadMessage('Upload failed.');
      toast.error('Upload failed.');
      setUploading(false);
    }
  };
  const handleAsk = async () => {
    if (!question) return;
    setQaLoading(true);
    setAnswer('Thinking...');
    try {
      const res = await axios.post(`${BASE_URL}/ask/`, { question });
      setAnswer(res.data.answer);
      setLastQuestion(question);
      setQaHistory(prev => [
        { question, answer: res.data.answer },
        ...prev
      ]);
      setQuestion('');
      toast.success('Answer received!');
    } catch (err) {
      setAnswer('Failed to get answer.');
      toast.error('Failed to get answer.');
    }
    setQaLoading(false);
  };

  // Onboarding: tips
  useEffect(() => {
    const tips = [
      'You can upload any PDF and ask questions about its content!',
      'Try asking about a specific section or topic in your PDF.',
      'Your Q&A history is always available on the right.',
      'Powered by Retrieval Augmented Generation (RAG) technology.',
      'You can download or preview your uploaded PDF anytime.',
    ];
    setDidYouKnow(tips[Math.floor(Math.random() * tips.length)]);
  }, []);

  // Process PDF (extract, embed, store)
  const handleProcess = async (filename) => {
    try {
      await axios.post(`${BASE_URL}/process-pdf/`, { filename });
      setUploadMessage('PDF is ready! You can now ask questions.');
      setReady(true);
      toast.success('PDF processed and ready!');
      // Fetch important points
      setLoadingPoints(true);
      setImportantPoints([]);
      setShowPointsPanel(true);
      try {
        const res = await axios.post(`${BASE_URL}/extract-points/`, { filename });
        setImportantPoints(res.data.points || []);
      } catch (err) {
        setImportantPoints([]);
      }
      setLoadingPoints(false);
    } catch (err) {
      setUploadMessage('Processing failed.');
      toast.error('Processing failed.');
      setReady(false);
    }
    setProcessing(false);
  };

  // Animated gradient background
  const gradientBg = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
    background: '#181a1b',
    pointerEvents: 'none',
  };

  // Keyframes for gradient animation
  const styleSheet = document.styleSheets[0];
  if (styleSheet && !Array.from(styleSheet.cssRules).find(r => r.name === 'gradientMove')) {
    styleSheet.insertRule(`@keyframes gradientMove {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }`, styleSheet.cssRules.length);
    styleSheet.insertRule(`@keyframes fadeInCard {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: none; }
    }`, styleSheet.cssRules.length);
  }

  // Material UI theme
  const theme = createTheme({
    palette: {
      mode: 'dark',
      background: {
        default: '#181a1b',
        paper: '#232425',
      },
      primary: {
        main: '#2196f3', // blue accent
      },
      secondary: {
        main: '#43a047',
      },
      text: {
        primary: '#f5f6fa',
        secondary: '#b0b3b8',
      },
    },
    typography: {
      fontFamily: 'Inter, Roboto, Arial, sans-serif',
    },
  });

  // Render history panel as a static sidebar
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* Welcome Overlay */}
      {showWelcome && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 9999,
            background: 'rgba(10,20,40,0.98)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'top 0.6s cubic-bezier(.4,1.3,.5,1), opacity 0.6s',
            opacity: 1,
            pointerEvents: 'auto',
          }}
        >
          <div style={{
            color: '#fff',
            fontSize: 38,
            fontWeight: 700,
            textAlign: 'center',
            letterSpacing: 1.2,
            padding: 48,
            borderRadius: 24,
            background: 'rgba(30,40,60,0.85)',
            boxShadow: '0 4px 32px #0008',
            animation: 'fadeInWelcome 1.2s',
            maxWidth: 520,
            fontFamily: 'Inter, Roboto, Arial, sans-serif',
          }}>
            <span style={{
              fontSize: 54,
              display: 'block',
              marginBottom: 18,
              background: 'linear-gradient(135deg, #90caf9 60%, #1976d2 100%)',
              borderRadius: '50%',
              width: 64,
              height: 64,
              margin: '0 auto 18px auto',
              boxShadow: '0 2px 8px #1976d244',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: 32, marginRight: 0, marginLeft: 2 }}>📄</span>
              <span style={{ fontSize: 28, marginLeft: -2 }}>💬</span>
            </span>
            Welcome to <span style={{ color: '#90caf9' }}>DocuChat</span>!<br/>
            <span style={{ fontSize: 20, fontWeight: 400, color: '#b0c4d4', display: 'block', marginTop: 18 }}>
              Upload a PDF and ask anything about it.<br/>
              Powered by LangChain, Chroma, and OpenAI.
            </span>
            <div style={{ marginTop: 32, fontSize: 17, color: '#ffe082', fontWeight: 500 }}>
              💡 Did you know? <span>{didYouKnow}</span>
            </div>
            {/* Loading spinner for welcome screen */}
            <div style={{ marginTop: 38, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#90caf9', fontWeight: 500, fontSize: 16 }}>Loading DocuChat...</span>
              <span style={{
                display: 'inline-block',
                width: 38,
                height: 38,
                border: '5px solid #90caf9',
                borderTop: '5px solid #1976d2',
                borderRadius: '50%',
                animation: 'spinWelcome 1s linear infinite',
                marginTop: 2,
              }} />
            </div>
          </div>
          <style>{`
            @keyframes fadeInWelcome {
              from { opacity: 0; transform: scale(0.98) translateY(30px); }
              to { opacity: 1; transform: none; }
            }
            @keyframes spinWelcome {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
      <div
        style={{
          minHeight: '100vh',
          background: 'transparent',
          padding: 0,
          margin: 0,
          position: 'relative',
          fontFamily: 'Inter, Roboto, Arial, sans-serif',
          opacity: mainVisible ? 1 : 0,
          transform: mainVisible ? 'translateY(0)' : 'translateY(40px)',
          transition: 'opacity 0.7s cubic-bezier(.39,.575,.565,1), transform 0.7s cubic-bezier(.39,.575,.565,1)',
        }}
      >
        <div style={gradientBg}></div>
        <ToastContainer position="top-center" autoClose={2500} hideProgressBar theme={darkMode ? 'dark' : 'light'} />
        {/* Header at the top */}
        <header style={{
          width: '100%',
          minHeight: 100,
          background: '#232425',
          color: '#f5f6fa',
          textAlign: 'center',
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: 1.5,
          fontFamily: 'Inter, sans-serif',
          boxShadow: '0 1px 6px #000a',
          marginBottom: 24,
          zIndex: 2,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, height: 54, marginTop: 0 }}>
              <span style={{
                fontSize: 32,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #90caf9 60%, #1976d2 100%)',
                borderRadius: '50%',
                width: 44,
                height: 44,
                boxShadow: '0 2px 8px #1976d244',
                position: 'relative',
                animation: 'logoBounce 1.1s cubic-bezier(.39,.575,.565,1)',
              }}>
                <span style={{
                  position: 'absolute',
                  top: -4,
                  left: -4,
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'conic-gradient(from 0deg, #90caf9, #1976d2, #90caf9 100%)',
                  zIndex: 0,
                  filter: 'blur(2px)',
                  opacity: 0.7,
                  animation: 'logoBorderSpin 2.5s linear infinite',
                  pointerEvents: 'none',
                }} />
                <span style={{ fontSize: 20, marginRight: 0, marginLeft: 2, zIndex: 1, position: 'relative' }}>📄</span>
                <span style={{ fontSize: 16, marginLeft: -2, zIndex: 1, position: 'relative' }}>💬</span>
                <style>{`
                  @keyframes logoBorderSpin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                  @keyframes logoBounce {
                    0% { transform: scale(0.7) translateY(-20px); opacity: 0; }
                    60% { transform: scale(1.1) translateY(8px); opacity: 1; }
                    80% { transform: scale(0.95) translateY(-2px); }
                    100% { transform: scale(1) translateY(0); opacity: 1; }
                  }
                `}</style>
              </span>
              <span style={{ fontWeight: 700, fontSize: 28, letterSpacing: 1.5, lineHeight: 1 }}>DocuChat</span>
            </div>
          </div>
        </header>
        {/* Main content and sidebar in a flex row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', width: '100%' }}>
          <main style={{
            width: 1000,
            margin: '0 auto',
            fontFamily: 'Inter, sans-serif',
            background: '#232425',
            borderRadius: 18,
            boxShadow: '0 2px 12px #000a',
            padding: 32,
            color: '#f5f6fa',
            minHeight: 340,
            display: 'flex',
            flexDirection: 'row',
            gap: 36,
            backdropFilter: 'blur(0px)',
            border: '1.5px solid #232425',
            animation: 'fadeInCard 0.8s cubic-bezier(.39,.575,.565,1)',
            boxSizing: 'border-box',
            transition: 'margin 0.4s',
          }}>
            {/* Left column: PDF upload/preview */}
            <div style={{ flex: 1, minWidth: 260, maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 0, marginTop: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8, letterSpacing: 0.5 }}>PDF Upload & Preview</div>
              <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: 'none', boxShadow: 'none', padding: 0 }}>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  style={{
                    marginBottom: 0,
                    color: '#f5f6fa',
                    background: '#181a1b',
                    border: '1.5px solid #232425',
                    borderRadius: 8,
                    padding: 10,
                    width: '100%',
                    cursor: 'pointer',
                    transition: 'border 0.2s, box-shadow 0.2s',
                    boxShadow: '0 1px 4px #0002',
                  }}
                  onMouseOver={e => e.target.style.border = '1.5px solid #2196f3'}
                  onMouseOut={e => e.target.style.border = '1.5px solid #232425'}
                />
                {uploadedFilename && (
                  <div style={{ color: '#2196f3', fontSize: 15, marginTop: 2, fontWeight: 500 }}>
                    <span style={{ fontSize: 18 }}>📎</span> {uploadedFilename}
                    {pdfFile && (
                      <div style={{ marginTop: 4, display: 'flex', flexDirection: 'row', gap: 18 }}>
                        <a
                          href={URL.createObjectURL(pdfFile)}
                          download={uploadedFilename}
                          style={{ color: '#43a047', textDecoration: 'underline', fontSize: 15, fontWeight: 700 }}
                        >
                          Download
                        </a>
                        <a
                          href={URL.createObjectURL(pdfFile)}
          target="_blank"
          rel="noopener noreferrer"
                          style={{ color: '#43a047', textDecoration: 'underline', fontSize: 15, fontWeight: 700 }}
                        >
                          PDF Preview
                        </a>
                      </div>
                    )}
                  </div>
                )}
              <button
                onClick={handleUpload}
                disabled={uploading || processing || !pdfFile}
                style={{
                  padding: '12px 36px',
                  borderRadius: 10,
                  border: 'none',
                  background: uploading || processing || !pdfFile ? '#232425' : '#2196f3',
                  color: uploading || processing || !pdfFile ? '#b0b3b8' : '#fff',
                  fontWeight: 700,
                  fontSize: 17,
                  cursor: uploading || processing || !pdfFile ? 'not-allowed' : 'pointer',
                  marginBottom: 0,
                  marginTop: 8,
                  boxShadow: uploading || processing || !pdfFile ? 'none' : '0 1px 8px #000a',
                  transition: 'background 0.2s, box-shadow 0.2s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseOver={e => { if (!(uploading || processing || !pdfFile)) e.target.style.background = '#2196f3'; }}
                onMouseOut={e => { if (!(uploading || processing || !pdfFile)) e.target.style.background = '#2196f3'; }}
              >
                {uploading ? <span className="spinner" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }}><Spinner /></span> : processing ? <span className="spinner" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }}><Spinner /></span> : null}
                {uploading ? 'Uploading...' : processing ? 'Processing...' : 'Upload PDF'}
              </button>
              <div style={{ color: ready ? '#4caf50' : (darkMode ? '#f1f1f1' : '#222'), minHeight: 24, fontSize: 15, marginTop: 4 }}>{uploadMessage}</div>
              {/* Important Points Panel (minimizable) */}
              {importantPoints.length > 0 && ready && (
                <div style={{
                  marginTop: 18,
                  background: '#232425',
                  borderRadius: 12,
                  boxShadow: '0 1px 8px #000a',
                  border: '1.5px solid #232425',
                  padding: showPointsPanel ? 20 : '8px 20px',
                  color: '#f5f6fa',
                  fontSize: 16,
                  maxWidth: 520,
                  transition: 'padding 0.2s',
                  position: 'relative',
                }}>
                  <button
                    onClick={() => setShowPointsPanel(v => !v)}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 12,
                      background: 'none',
                      border: 'none',
                      color: '#90caf9',
                      fontWeight: 700,
                      fontSize: 18,
                      cursor: 'pointer',
                      zIndex: 2,
                    }}
                    aria-label={showPointsPanel ? 'Minimize' : 'Show important points'}
                  >
                    {showPointsPanel ? '–' : '+'}
                  </button>
                  <div style={{ fontWeight: 700, fontSize: 18, marginBottom: showPointsPanel ? 10 : 0, color: '#90caf9', letterSpacing: 0.5 }}>
                    Key Points 
                  </div>
                  {showPointsPanel && (
                    <ul style={{ paddingLeft: 18, margin: 0, maxHeight: 180, overflowY: 'auto', paddingRight: 10 }}>
                      {importantPoints.map((pt, idx) => (
                        <li key={idx} style={{ marginBottom: 8, lineHeight: 1.5 }}>{pt}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          </div>
          {/* Divider for large screens */}
          <div style={{ width: 1, background: '#fff', margin: '0 24px', minHeight: 600, alignSelf: 'stretch', display: window.innerWidth > 700 ? 'block' : 'none' }} />
          {/* Right column: Q&A and history */}
          <div style={{ flex: 2, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 0, marginTop: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8, letterSpacing: 0.5 }}>Ask Questions</div>
            {/* Q&A */}
            <section style={{
              opacity: ready ? 1 : 0.5,
              pointerEvents: ready ? 'auto' : 'none',
              transition: 'opacity 0.3s',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              background: darkMode ? 'rgba(20,20,20,0.7)' : 'rgba(255,255,255,0.7)',
              borderRadius: 12,
              padding: 18,
              boxShadow: '0 1px 6px #0002',
            }}>
              <label style={{ fontWeight: 600, fontSize: 18, marginBottom: 6 }}>Ask a question</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  placeholder="Ask a question about the PDF..."
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  style={{
                    flex: 1,
                    padding: 18,
                    borderRadius: 12,
                    border: '1.5px solid #232425',
                    background: '#181a1b',
                    color: '#f5f6fa',
                    fontSize: 18,
                    outline: 'none',
                    transition: 'border 0.2s, box-shadow 0.2s',
                    boxShadow: '0 1px 4px #0002',
                  }}
                  disabled={!ready}
                  onKeyDown={e => { if (e.key === 'Enter') handleAsk(); }}
                  onFocus={e => e.target.style.border = '1.5px solid #28a745'}
                  onBlur={e => e.target.style.border = '1.5px solid #333'}
                />
                <button
                  onClick={handleAsk}
                  disabled={qaLoading || !question || !ready}
                  style={{
                    padding: '18px 32px',
                    borderRadius: 12,
                    border: 'none',
                    background: qaLoading || !question || !ready ? '#232425' : '#2196f3',
                    color: qaLoading || !question || !ready ? '#b0b3b8' : '#fff',
                    fontWeight: 700,
                    fontSize: 18,
                    cursor: qaLoading || !question || !ready ? 'not-allowed' : 'pointer',
                    boxShadow: qaLoading || !question || !ready ? 'none' : '0 1px 8px #000a',
                    transition: 'background 0.2s, box-shadow 0.2s',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onMouseOver={e => { if (!(qaLoading || !question || !ready)) e.target.style.background = '#2196f3'; }}
                  onMouseOut={e => { if (!(qaLoading || !question || !ready)) e.target.style.background = '#2196f3'; }}
                >
                  {qaLoading ? <span className="spinner" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }}><Spinner /></span> : null}
                  {qaLoading ? 'Thinking...' : 'Ask'}
                </button>
              </div>
            </section>
            {/* Answer */}
            {qaHistory.length > 0 && (
              <section style={{
                background: '#181a1b',
                padding: 32,
                borderRadius: 16,
                minHeight: 40,
                color: '#f5f6fa',
                boxShadow: '0 1px 8px #000a',
                fontSize: 20,
                marginTop: 8,
                wordBreak: 'break-word',
                transition: 'background 0.2s',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                maxHeight: 260,
                overflowY: 'auto',
              }}>
                {qaHistory.map((item, idx) => (
                  <div key={idx} style={{ marginBottom: 18, borderBottom: '1px solid #232425', paddingBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, color: '#90caf9', fontSize: 18 }}>Q: {item.question}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <span style={{ color: '#4caf50', fontWeight: 700 }}>Answer: </span>
                        <span style={{ fontSize: 18 }}>{item.answer}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            )}
            {/* Q&A History is now in a floating panel */}
          </div>
        </main>
        </div>
        <footer style={{
          textAlign: 'center',
          color: '#b0b3b8',
          fontSize: 14,
          marginTop: 24,
          letterSpacing: 0.5,
          zIndex: 2,
          position: 'relative',
        }}>
          &copy; {new Date().getFullYear()} RAG UI. Powered by <a href="https://github.com/hwchase17/langchain" style={{ color: '#2196f3', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">LangChain</a>, <a href="https://www.trychroma.com/" style={{ color: '#2196f3', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">Chroma</a>, and <a href="https://platform.openai.com/" style={{ color: '#2196f3', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">OpenAI</a>.
        </footer>
    </div>
    </ThemeProvider>
  );
}

// Simple spinner component
function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: 18,
      height: 18,
      border: '3px solid #90caf9',
      borderTop: '3px solid transparent',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
      verticalAlign: 'middle',
    }} />
  );
}

// Add spinner keyframes if not present
const styleSheet = document.styleSheets[0];
if (styleSheet && !Array.from(styleSheet.cssRules).find(r => r.name === 'spin')) {
  styleSheet.insertRule(`@keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }`, styleSheet.cssRules.length);
}

// Clamp function to keep x/y within viewport
function clampHistoryPos(x, y, width = 320, height = 400) {
  return {
    x: Math.min(window.innerWidth - width, Math.max(0, x)),
    y: Math.min(window.innerHeight - height, Math.max(0, y)),
  };
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/rag" element={<RAGUI />} />
        <Route path="/" element={<Navigate to="/rag" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
