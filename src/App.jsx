import { useState, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import imageCompression from 'browser-image-compression'; // הייבוא החדש שלנו!
import { storage, db } from './firebase';
import './App.css';

function App() {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [mediaItems, setMediaItems] = useState([]);

  // טיפול בבחירת קבצים
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;
    setFiles(selectedFiles);
    const objectUrls = selectedFiles.map(file => URL.createObjectURL(file));
    setPreviews(objectUrls);
  };

  useEffect(() => {
    return () => previews.forEach(url => URL.revokeObjectURL(url));
  }, [previews]);

  // משיכת הגלריה בזמן אמת
  useEffect(() => {
    const q = query(collection(db, 'media'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
      setMediaItems(items);
    });
    return () => unsubscribe();
  }, []);

  // פונקציית ההעלאה המשודרגת (עם דחיסה)
  const handleUpload = async () => {
    if (files.length === 0) return;
    setIsUploading(true);
    setUploadedCount(0);

    try {
      // שלב 1: דחיסת הקבצים לפני ההעלאה
      console.log("מתחיל דחיסת קבצים...");
      
      const processedFiles = await Promise.all(files.map(async (file) => {
        // אנחנו דוחסים רק תמונות (וידאו קשה לדחוס בדפדפן ולכן נעביר אותו כמו שהוא)
        if (file.type.startsWith('image/')) {
          const options = {
            maxSizeMB: 1,           // נגביל את הקובץ ל-1 מגה-בייט
            maxWidthOrHeight: 1920, // רזולוציית Full HD מספיקה בהחלט
            useWebWorker: true,     // שימוש בתהליכון רקע כדי לא לתקוע את הממשק
          };
          
          try {
            const compressedFile = await imageCompression(file, options);
            console.log(`קובץ נדחס: מ-${(file.size/1024/1024).toFixed(2)}MB ל-${(compressedFile.size/1024/1024).toFixed(2)}MB`);
            return compressedFile;
          } catch (error) {
            console.error("שגיאה בדחיסת קובץ, ממשיך עם המקורי", error);
            return file; // אם הדחיסה נכשלה, נשתמש בקובץ המקורי
          }
        }
        return file; // אם זה וידאו, נחזיר אותו ללא שינוי
      }));

      // שלב 2: העלאת הקבצים הדחוסים לפיירבייס
      console.log("מתחיל העלאה לשרת...");
      
      const uploadPromises = processedFiles.map((file) => {
        return new Promise((resolve, reject) => {
          const fileRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
          const uploadTask = uploadBytesResumable(fileRef, file);

          uploadTask.on(
            'state_changed',
            null, 
            (error) => {
              console.error("Upload error", error);
              reject(error);
            },
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              await addDoc(collection(db, 'media'), {
                url: downloadURL,
                type: file.type.startsWith('video/') ? 'video' : 'image',
                timestamp: serverTimestamp(),
              });
              setUploadedCount(prev => prev + 1);
              resolve();
            }
          );
        });
      });

      await Promise.all(uploadPromises);
      alert("כל התמונות הועלו בהצלחה! 🎉");
      setFiles([]);
      setPreviews([]);
      
    } catch (error) {
      alert("חלק מהקבצים לא הועלו עקב שגיאה 😕");
    } finally {
      setIsUploading(false);
      setUploadedCount(0);
    }
  };
return (
    <div className="App">
      <h1>החתונה של רוני ולי💍</h1>
      <p>נשמח שתשתפו איתנו את הרגעים שלכם!</p>

      {/* פה החבאנו את האינפוט המקורי ויצרנו כפתור יפה במקומו */}
      <label className="custom-file-upload">
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileChange}
        />
        📸 לחצו כאן לבחירת תמונות
      </label>

      {previews.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', margin: '20px 0' }}>
          {previews.map((src, index) => (
            <img key={index} src={src} alt="preview" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #D4AF37' }} />
          ))}
        </div>
      )}

      <div style={{ marginTop: '10px', marginBottom: '30px' }}>
        <button 
          className="upload-action-btn"
          onClick={handleUpload} 
          disabled={files.length === 0 || isUploading}
        >
          {isUploading 
            ? `מעלה... (${uploadedCount}/${files.length})` 
            : files.length > 0 ? `🚀 שלחו ${files.length} קבצים` : 'ממתין לקבצים...'}
        </button>
      </div>

      <hr style={{ borderColor: 'rgba(0,0,0,0.1)', margin: '30px 0' }} />
      <h2>גלריית האירוע ✨</h2>
      
      {mediaItems.length === 0 && !isUploading ? (
        <p>עדיין אין תמונות בגלריה. תהיו הראשונים להעלות! 😊</p>
      ) : (
        <div className="gallery-grid">
          {mediaItems.map((item) => (
            <div key={item.id} className="media-card">
              {item.type === 'video' ? (
                <video src={item.url} controls />
              ) : (
                <img src={item.url} alt="Wedding moment" loading="lazy" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;