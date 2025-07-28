import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

function RAGUI() {
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
  const [qaLoading, setQaLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [qaHistory, setQaHistory] = useState([]);
  const [importantPoints, setImportantPoints] = useState([]);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [showPointsPanel, setShowPointsPanel] = useState(true);

  // Show welcome overlay, then fade out after 3 seconds
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
  const BASE_URL = process.env.REACT_APP_API_URL || 'https://docuchat-backend-n9wm.onrender.com';

  // Handle PDF file selection
  const handleFileChange = (e) => {
    setPdfFile(e.target.files[0]);
    setUploadedFilename('');
    setUploadMessage('');
    setReady(false);
  };

  // Handle PDF upload
  const handleUpload = async () => {
    if (!pdfFile) {
      toast.error('Please select a PDF file first!');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', pdfFile);

    try {
      const response = await axios.post(`${BASE_URL}/upload-pdf/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setUploadedFilename(response.data.filename);
      setUploadMessage('PDF uploaded! Processing...');
      
      // Automatically process the PDF
      await handleProcess(response.data.filename);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload PDF. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Handle PDF processing
  const handleProcess = async (filename) => {
    setProcessing(true);
    try {
      const response = await axios.post(`${BASE_URL}/process-pdf/`, { filename });
      setUploadMessage(`PDF processed! Ready to answer questions.`);
      setReady(true);
      
      // Extract key points
      await handleExtractPoints(filename);
      
    } catch (error) {
      console.error('Processing error:', error);
      toast.error('Failed to process PDF. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Handle asking questions
  const handleAsk = async () => {
    if (!question.trim()) {
      toast.error('Please enter a question!');
      return;
    }

    setQaLoading(true);
    try {
      const response = await axios.post(`${BASE_URL}/ask/`, { question });
      const newQa = { question: question, answer: response.data.answer };
      setQaHistory(prev => [...prev, newQa]);
      setQuestion('');
    } catch (error) {
      console.error('Ask error:', error);
      toast.error('Failed to get answer. Please try again.');
    } finally {
      setQaLoading(false);
    }
  };

  // Handle extracting key points
  const handleExtractPoints = async (filename) => {
    setLoadingPoints(true);
    try {
      const response = await axios.post(`${BASE_URL}/extract-points/`, { filename });
      setImportantPoints(response.data.points || []);
    } catch (error) {
      console.error('Extract points error:', error);
    } finally {
      setLoadingPoints(false);
    }
  };

  // Theme configuration
  const theme = createTheme({
    palette: {
      mode: 'dark',
      primary: {
        main: '#90caf9',
      },
      background: {
        default: '#0a0a0a',
        paper: '#232425',
      },
    },
  });

  // Welcome overlay
  if (showWelcome) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          color: '#f5f6fa',
          fontFamily: 'Inter, sans-serif',
        }}>
          <div style={{ fontSize: 48, fontWeight: 700, marginBottom: 20, letterSpacing: 2 }}>
            DocuChat
          </div>
          <div style={{ fontSize: 18, marginBottom: 30, opacity: 0.8 }}>
            Chat with your PDFs using AI
          </div>
          <div style={{ fontSize: 16, opacity: 0.6, textAlign: 'center', maxWidth: 400 }}>
            Loading your intelligent document assistant...
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
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
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
          zIndex: -1,
        }}></div>
        
        <ToastContainer position="top-center" autoClose={2500} hideProgressBar theme={'dark'} />

        {/* Header */}
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
              <div style={{
                width: 48,
                height: 48,
                background: 'linear-gradient(135deg, #90caf9, #2196f3)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                fontWeight: 700,
                color: '#fff',
                boxShadow: '0 4px 12px rgba(144, 202, 249, 0.3)',
                animation: 'pulse 2s infinite',
              }}>
                DC
              </div>
              <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: 1.5 }}>DocuChat</span>
            </div>
          </div>
        </header>

        {/* Main content */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', width: '100%', gap: 24 }}>
          <main style={{
            width: 1000,
            margin: '0 auto',
            fontFamily: 'Inter, sans-serif',
            background: '#232425',
            borderRadius: 18,
            boxShadow: '0 2px 12px #000a',
            padding: 20,
            color: '#f5f6fa',
            minHeight: 340,
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
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
                  accept=".pdf"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  id="pdf-upload"
                />
                <label
                  htmlFor="pdf-upload"
                  style={{
                    display: 'inline-block',
                    padding: '12px 24px',
                    background: '#90caf9',
                    color: '#000',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 16,
                    transition: 'all 0.2s',
                    border: 'none',
                    boxShadow: '0 2px 8px rgba(144, 202, 249, 0.3)',
                  }}
                >
                  Choose PDF File
                </label>
                
                {pdfFile && (
                  <div style={{ textAlign: 'center', marginTop: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 5 }}>{pdfFile.name}</div>
                    <button
                      onClick={handleUpload}
                      disabled={uploading}
                      style={{
                        padding: '8px 16px',
                        background: '#4caf50',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        cursor: uploading ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        fontSize: 14,
                        opacity: uploading ? 0.6 : 1,
                      }}
                    >
                      {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                )}

                {uploadMessage && (
                  <div style={{ textAlign: 'center', marginTop: 10, fontSize: 14, color: '#90caf9' }}>
                    {uploadMessage}
                  </div>
                )}

                {/* Important Points Panel */}
                {importantPoints.length > 0 || loadingPoints ? (
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
                    <div style={{ fontWeight: 700, fontSize: 18, marginBottom: showPointsPanel ? 10 : 0, color: '#90caf9', letterSpacing: 0.5 }}>
                      Key Points
                    </div>
                    {showPointsPanel && (
                      <ul style={{ paddingLeft: 18, margin: 0, maxHeight: 180, overflowY: 'auto', paddingRight: 10 }}>
                        {loadingPoints ? (
                          <div style={{ color: '#90caf9', fontSize: 16 }}>Extracting points...</div>
                        ) : importantPoints.length === 0 ? (
                          <div style={{ color: '#888', fontSize: 15 }}>No points found.</div>
                        ) : (
                          importantPoints.map((pt, idx) => (
                            <li key={idx} style={{ marginBottom: 8, lineHeight: 1.5 }}>{pt}</li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>
                ) : null}
              </section>
            </div>

            {/* Right column: Q&A */}
            <div style={{ flex: 2, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 0, marginTop: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8, letterSpacing: 0.5 }}>Ask Questions</div>
              <section style={{
                opacity: ready ? 1 : 0.5,
                pointerEvents: ready ? 'auto' : 'none',
                transition: 'opacity 0.3s',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                background: 'rgba(20,20,20,0.7)',
                borderRadius: 12,
                padding: 18,
                boxShadow: '0 1px 6px #0002',
              }}>
                <label style={{ fontWeight: 600, fontSize: 18, marginBottom: 6 }}>Ask a question</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask anything about your PDF..."
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      background: '#181a1b',
                      border: '1px solid #232425',
                      borderRadius: 8,
                      color: '#f5f6fa',
                      fontSize: 16,
                      outline: 'none',
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleAsk()}
                  />
                  <button
                    onClick={handleAsk}
                    disabled={qaLoading || !question || !ready}
                    style={{
                      padding: '12px 24px',
                      background: qaLoading || !question || !ready ? '#666' : '#90caf9',
                      color: '#000',
                      border: 'none',
                      borderRadius: 8,
                      cursor: qaLoading || !question || !ready ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      fontSize: 16,
                      transition: 'all 0.2s',
                    }}
                  >
                    {qaLoading ? 'Thinking...' : 'Ask'}
                  </button>
                </div>
              </section>
              
              {/* Answer / Q&A History */}
              {qaHistory.length > 0 && (
                <section style={{
                  background: '#181a1b',
                  padding: 20,
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
          &copy; {new Date().getFullYear()} DocuChat. Powered by <a href="https://github.com/hwchase17/langchain" style={{ color: '#2196f3', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">LangChain</a>, <a href="https://www.trychroma.com/" style={{ color: '#2196f3', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">Chroma</a>, and <a href="https://platform.openai.com/" style={{ color: '#2196f3', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">OpenAI</a>.
        </footer>
      </div>
    </ThemeProvider>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RAGUI />} />
        <Route path="/rag" element={<RAGUI />} />
      </Routes>
    </Router>
  );
}

export default App;
