import { useState, useEffect } from 'react'
import axios from 'axios'
import React from 'react'
import { useNavigate } from 'react-router-dom'

const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent"
const API_KEY = "AIzaSyBsyTlrlszK8-o5EDjbMEL4mBY4SPQCIkg"

const SubjectCard = ({ subject, tests, feedback, loading, onRunDiagnostic }) => {
  return (
    <div style={styles.card}>
      <h2>{subject}</h2>
      <div style={styles.testList}>
        {tests.map((test, index) => (
          <div key={index} style={styles.testItem}>
            <div style={styles.testHeader}>
              <span style={styles.topicName}>{subject}</span>
              <span style={styles.difficultyBadge(test.difficulty)}>
                {test.difficulty || "No Difficulty Set"}
              </span>
            </div>
            <div style={styles.testDetails}>
              <span>Score: <strong>{test.score}/10</strong></span>
              <span>Test #{index + 1}</span>
            </div>
          </div>
        ))}
      </div>
      <button
        style={styles.button}
        onClick={() => onRunDiagnostic(subject, tests)}
        disabled={loading}
      >
        {loading ? 'Analyzing...' : 'Run Diagnostic'}
      </button>
      {feedback && <div style={styles.feedbackBox}><strong>Feedback:</strong> {feedback}</div>}
    </div>
  )
}

function AiProgressTracker() {
  const navigate = useNavigate();

  useEffect(()=>{
    if(!localStorage.getItem("student")){
      alert("signup first")
      navigate("/signup")
      return
    }
  },[])

  const [userName, setUserName] = useState('')
  const [userId, setUserId] = useState('')
  const [feedbacks, setFeedbacks] = useState({})
  const [loadingSubject, setLoadingSubject] = useState('')
  const [error, setError] = useState(null)
  const [userData, setUserData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true)
      try {
        const student = JSON.parse(localStorage.getItem('student'));

        if (!student || !student._id) {
          console.error('Student ID not found in localStorage');
          throw new Error('Student ID not found');
        }
        setUserName(student.firstName);
        setUserId(student._id);

        const response = await axios.get('http://localhost:3000/api/test/gettestdata', {
          params: {
            userId: student._id
          }
        });
        
        const testsBySubject = {};
        Object.keys(response.data).forEach(subject => {
          testsBySubject[subject] = response.data[subject].map(({ userId, subject, score, difficulty }) => ({
            userId,
            subject,
            score,
            difficulty
          }));
        });
        
        setUserData(testsBySubject)
        setLoading(false)
      } catch (error) {
        console.error("Error fetching user data:", error)
        setError("Could not load user data from server. Using sample data for demonstration.")
        setLoading(false)
      }
    }
    
    fetchUserData()
  }, [userId])

  const runDiagnostic = async (subject, tests) => {
    setLoadingSubject(subject)
    setFeedbacks((prev) => ({ ...prev, [subject]: '' }))
    setError(null)

    const generateDetailedFeedback = (subject, tests) => {
      const avgScore = tests.reduce((sum, test) => sum + test.score, 0) / tests.length;
      
      const byDifficulty = tests.reduce((acc, test) => {
        if (!acc[test.difficulty]) acc[test.difficulty] = [];
        acc[test.difficulty].push(test);
        return acc;
      }, {});
      
      const avgByDifficulty = {};
      Object.keys(byDifficulty).forEach(diff => {
        avgByDifficulty[diff] = byDifficulty[diff].reduce((sum, t) => sum + t.score, 0) / byDifficulty[diff].length;
      });
      
      const sortedByScore = [...tests].sort((a, b) => a.score - b.score);
      const weakestTests = sortedByScore.slice(0, Math.min(2, tests.length));
      const strongestTests = sortedByScore.slice(-Math.min(2, tests.length)).reverse();

      let feedback = `### ${subject} Performance Analysis\n\n`;
      
      feedback += `**Overall Assessment**: Your average score in ${subject} is ${avgScore.toFixed(1)}/10. `;
      
      if (tests.length >= 2) {
        const trend = tests.slice(-3).map(t => t.score);
        const isImproving = trend[trend.length-1] > trend[trend.length-2];
        feedback += isImproving ? 
          `Your recent scores show improvement. ` : 
          `Your recent scores show you may need additional practice. `;
      }
      
      feedback += `\n\n**Difficulty Breakdown**:\n`;
      Object.keys(avgByDifficulty).forEach(diff => {
        feedback += `- ${diff} level: ${avgByDifficulty[diff].toFixed(1)}/10\n`;
      });
      
      feedback += `\n**Strengths**: You perform well in ${subject} at the ${strongestTests[0]?.difficulty || "higher"} difficulty levels. `;
      feedback += `\n**Areas for Improvement**: Focus on strengthening your performance in ${weakestTests[0]?.difficulty || "challenging"} tests. `;
      
      let weakestDifficulty = "challenging areas";
      if (Object.keys(avgByDifficulty).length > 0) {
        weakestDifficulty = Object.entries(avgByDifficulty)
          .sort(([,a], [,b]) => a - b)[0][0];
      }
      
      feedback += `\n\n**Recommended Study Plan**:\n`;
      feedback += `1. Allocate more time to ${weakestDifficulty} difficulty topics.\n`;
      feedback += `2. Review your notes from tests where you scored lower.\n`;
      feedback += `3. Consider getting additional practice material for ${subject}.\n`;
      feedback += `4. Build on your strengths while addressing weaker areas.\n`;
      feedback += `5. Set a goal to improve your average score to ${Math.min(10, avgScore + 1.5).toFixed(1)} in the next assessment.`;
      
      return feedback;
    };

    try {
      const response = await axios.post(
        `${API_URL}?key=${API_KEY}`,
        {
          contents: [
            {
              parts: [
                {
                  text: `You're an educational data analyst and academic coach. Analyze these test results for ${subject} and provide comprehensive, personalized feedback:
                  
Test Data: ${JSON.stringify(tests, null, 2)}

Include the following in your analysis:
1. Overall performance assessment
2. Strengths and weaknesses based on difficulty levels
3. Specific patterns or trends observed
4. Personalized study recommendations
5. Suggested resources or practice approaches
6. Short-term and long-term improvement goals

Format your response with clear sections and bullet points where appropriate.`,
                },
              ],
            },
          ],
        }
      )

      const feedback =
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No feedback returned.'
      setFeedbacks((prev) => ({ ...prev, [subject]: feedback }))
    } catch (error) {
      console.error('API Error:', error)
      
      const detailedFeedback = generateDetailedFeedback(subject, tests)
      setFeedbacks((prev) => ({
        ...prev,
        [subject]: detailedFeedback,
      }))
      
      setError(`Note: Using local analysis due to API connection issue (${error.message})`)
    } finally {
      setLoadingSubject('')
    }
  }

  return (
    <div style={styles.container}>
      <h1 className='bg-blue-400 border: rounded-1xl  p-4 text-2xl text-shadow-black'>AI Progress Tracker</h1>
      <h2 className='text-2xl py-4'>Welcome, {userName}</h2>
      {error && <div style={styles.errorMessage}>{error}</div>}
      
      {loading ? (
        <div style={styles.loadingContainer}>Loading student data...</div>
      ) : (
        <div style={styles.cardsContainer}>
          {Object.entries(userData).map(([subject, tests]) => (
            <SubjectCard
              key={subject}
              subject={subject}
              tests={tests}
              feedback={feedbacks[subject]}
              loading={loadingSubject === subject}
              onRunDiagnostic={runDiagnostic}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    maxWidth: '1000px',
    margin: '2rem auto',
    padding: '1rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  cardsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
    gap: '1.5rem',
  },
  card: {
    border: '1px solid #ddd',
    padding: '1.5rem',
    borderRadius: '12px',
    background: '#f9f9f9',
    boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
  },
  testList: {
    margin: '1rem 0',
  },
  testItem: {
    padding: '0.75rem',
    marginBottom: '0.75rem',
    background: '#fff',
    borderRadius: '8px',
    border: '1px solid #eee',
  },
  testHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  topicName: {
    fontWeight: 'bold',
  },
  difficultyBadge: (difficulty) => ({
    padding: '3px 8px',
    borderRadius: '12px',
    fontSize: '0.8rem',
    backgroundColor: difficulty === 'Easy' ? '#e0f7e0' : 
                    difficulty === 'Medium' ? '#fff0c0' : 
                    difficulty === 'Hard' ? '#ffe0e0' : '#e0e0e0',
    color: difficulty === 'Easy' ? '#2e7d32' : 
           difficulty === 'Medium' ? '#b78105' : 
           difficulty === 'Hard' ? '#c62828' : '#666',
  }),
  testDetails: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.9rem',
    color: '#666',
  },
  button: {
    padding: '10px 16px',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.2s',
    width: '100%',
    marginTop: '0.5rem',
  },
  feedbackBox: {
    marginTop: '1rem',
    background: '#f0f7ff',
    border: '1px solid #90caf9',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '0.95rem',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
  },
  errorMessage: {
    padding: '10px',
    backgroundColor: '#fff3cd',
    color: '#856404',
    borderRadius: '8px',
    marginBottom: '1rem',
    border: '1px solid #ffeeba',
  },
  loadingContainer: {
    padding: '2rem',
    textAlign: 'center',
    fontSize: '1.2rem',
    color: '#666',
  }
}

export default AiProgressTracker