import React, { useState, useRef, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { 
  Youtube, 
  Instagram, 
  Facebook, 
  Music, 
  Ghost, 
  UploadCloud, 
  Copy, 
  CheckCircle2, 
  Video,
  ExternalLink,
  Hash,
  AlignLeft,
  X,
  Loader2
} from 'lucide-react';

// Platform configurations with their respective web upload portals
const PLATFORMS = [
  { 
    id: 'youtube', 
    name: 'YouTube Shorts', 
    icon: Youtube, 
    color: 'text-red-500', 
    bgHover: 'hover:bg-red-500/10',
    borderColor: 'border-red-500/20',
    url: 'https://studio.youtube.com/channel/UC/videos/upload?d=sq' 
  },
  { 
    id: 'tiktok', 
    name: 'TikTok', 
    icon: Music, 
    color: 'text-cyan-400', 
    bgHover: 'hover:bg-cyan-400/10',
    borderColor: 'border-cyan-400/20',
    url: 'https://www.tiktok.com/creator-center/upload' 
  },
  { 
    id: 'instagram', 
    name: 'Instagram Reels', 
    icon: Instagram, 
    color: 'text-pink-500', 
    bgHover: 'hover:bg-pink-500/10',
    borderColor: 'border-pink-500/20',
    url: 'https://www.instagram.com/reels/create/' 
  },
  { 
    id: 'facebook', 
    name: 'Facebook Reels', 
    icon: Facebook, 
    color: 'text-blue-500', 
    bgHover: 'hover:bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    url: 'https://business.facebook.com/creatorstudio/home' 
  },
  { 
    id: 'snapchat', 
    name: 'Snapchat Spotlight', 
    icon: Ghost, 
    color: 'text-yellow-400', 
    bgHover: 'hover:bg-yellow-400/10',
    borderColor: 'border-yellow-400/20',
    url: 'https://my.snapchat.com/' 
  }
];

export default function App() {
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [copiedStates, setCopiedStates] = useState({});
  const [uploadState, setUploadState] = useState({ isUploading: false, status: '' });
  const fileInputRef = useRef(null);

  // BUG FIX: Memory Management - Cleanup object URL on unmount or before creating a new one
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('video/')) {
      // BUG FIX: Revoke previous URL if it exists
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
      
      setVideoFile(file);
      // Create a local URL to preview the video without uploading anywhere
      const url = URL.createObjectURL(file);
      setVideoPreviewUrl(url);
    } else if (file) {
      alert('Please select a valid video file.');
    }
  };

  const removeVideo = () => {
    // BUG FIX: Revoke URL on removal
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setVideoFile(null);
    setVideoPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Modern clipboard copy function with fallback
  const copyToClipboard = async (text, platformId) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard API not available');
      }
      
      setCopiedStates(prev => ({ ...prev, [platformId]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [platformId]: false }));
      }, 3000);
    } catch (err) {
      // Fallback for older browsers or restricted environments (like some iframes)
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand('copy');
        setCopiedStates(prev => ({ ...prev, [platformId]: true }));
        setTimeout(() => {
          setCopiedStates(prev => ({ ...prev, [platformId]: false }));
        }, 3000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
        alert('Could not copy to clipboard automatically. Please copy the text manually.');
      }
      document.body.removeChild(textArea);
    }
  };

  // Handle YouTube one-click upload
  const handleYouTubeUpload = async (accessToken) => {
    if (!videoFile) return;
    
    setUploadState({ isUploading: true, status: 'Initializing upload...' });
    
    const formattedTags = hashtags
      .split(/[\s,]+/)
      .filter(tag => tag.trim() !== '')
      .map(tag => {
        const cleanTag = tag.trim().replace(/^#+/, '');
        return cleanTag ? `#${cleanTag}` : '';
      })
      .filter(Boolean)
      .join(' ');
      
    const fullDescription = [caption.trim(), formattedTags].filter(Boolean).join('\n\n');
    const title = caption.trim().substring(0, 95) || 'My YouTube Short';

    try {
      // 1. Resumable Upload Initialization
      setUploadState({ isUploading: true, status: 'Creating entry...' });
      const initResponse = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Length': videoFile.size.toString(),
          'X-Upload-Content-Type': videoFile.type || 'video/mp4'
        },
        body: JSON.stringify({
          snippet: {
            title: title,
            description: fullDescription,
            categoryId: '22', // People & Blogs default
          },
          status: {
            privacyStatus: 'private', // Default to private for review
            selfDeclaredMadeForKids: false
          }
        })
      });

      if (!initResponse.ok) {
        throw new Error('Failed to initialize YouTube upload.');
      }

      const uploadUrl = initResponse.headers.get('Location');
      if (!uploadUrl) {
        throw new Error('Upload URL not found in response.');
      }

      // 2. Upload the actual video file bytes
      setUploadState({ isUploading: true, status: 'Uploading video...' });
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': videoFile.type || 'video/mp4'
        },
        body: videoFile
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload video bytes to YouTube.');
      }

      setUploadState({ isUploading: false, status: 'Upload complete!' });
      alert('Video successfully pushed to YouTube as Private!');
      
    } catch (error) {
      console.error(error);
      setUploadState({ isUploading: false, status: '' });
      alert('YouTube upload failed. Check the console for details.');
    }
  };

  const loginAndUploadYouTube = useGoogleLogin({
    onSuccess: (tokenResponse) => handleYouTubeUpload(tokenResponse.access_token),
    onError: (error) => {
      console.error('Login Failed:', error);
      alert('Google Login failed.');
    },
    scope: 'https://www.googleapis.com/auth/youtube.upload',
  });

  // Generate the final text to copy and open the platform
  const handlePlatformAction = (platform) => {
    if (platform.id === 'youtube') {
      loginAndUploadYouTube();
      return;
    }

    // BUG FIX: Enhanced hashtag parsing
    const formattedTags = hashtags
      .split(/[\s,]+/)
      .filter(tag => tag.trim() !== '')
      .map(tag => {
        const cleanTag = tag.trim().replace(/^#+/, '');
        return cleanTag ? `#${cleanTag}` : '';
      })
      .filter(Boolean)
      .join(' ');

    const fullText = [caption.trim(), formattedTags].filter(Boolean).join('\n\n');

    if (fullText) {
      copyToClipboard(fullText, platform.id);
    }
    
    // Open the creator upload portal in a new tab
    window.open(platform.url, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="text-center space-y-2 mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl mb-4 border border-indigo-500/20">
            <UploadCloud size={32} className="text-indigo-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 tracking-tight">
            Local Crosspost
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto text-lg">
            Prepare your Short once. Copy your caption automatically and open the creator portals to publish everywhere instantly. No backend required.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LEFT COLUMN: Input Details */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                <span className="bg-indigo-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">1</span>
                Prepare Content
              </h2>

              {/* Video Upload Area */}
              <div className="mb-6">
                {!videoPreviewUrl ? (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/50 hover:bg-slate-800 transition-all rounded-2xl p-8 text-center cursor-pointer group"
                  >
                    <Video size={48} className="mx-auto text-slate-500 group-hover:text-indigo-400 transition-colors mb-4" />
                    <p className="text-white font-medium mb-1">Select your Short (MP4)</p>
                    <p className="text-sm text-slate-400">Kept entirely on your local device.</p>
                  </div>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[400px] mx-auto border border-slate-700 flex items-center justify-center group">
                    <video 
                      src={videoPreviewUrl} 
                      className="w-full h-full object-contain"
                      controls
                      autoPlay
                      muted
                      loop
                    />
                    <button 
                      onClick={removeVideo}
                      className="absolute top-4 right-4 bg-black/60 hover:bg-red-500/80 text-white p-2 rounded-full backdrop-blur transition-colors"
                      title="Remove video"
                    >
                      <X size={20} />
                    </button>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="video/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </div>

              {/* Caption Input */}
              <div className="space-y-4">
                <div>
                  <label className="flex items-center text-sm font-medium text-slate-300 mb-2">
                    <AlignLeft size={16} className="mr-2 text-indigo-400" />
                    Universal Caption
                  </label>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Write your amazing caption here..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none transition-all h-32"
                  />
                </div>

                {/* Hashtags Input */}
                <div>
                  <label className="flex items-center text-sm font-medium text-slate-300 mb-2">
                    <Hash size={16} className="mr-2 text-cyan-400" />
                    Hashtags (space separated)
                  </label>
                  <input
                    type="text"
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                    placeholder="fyp shorts trending viral"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Publishing Actions */}
          <div className="space-y-6">
            <div className={`bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl transition-opacity duration-300 ${!videoPreviewUrl && !caption ? 'opacity-50 pointer-events-none grayscale-[0.5]' : 'opacity-100'}`}>
              <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                <span className="bg-indigo-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">2</span>
                Publish Everywhere
              </h2>
              <p className="text-sm text-slate-400 mb-6">
                Click a platform. We will copy your caption to your clipboard and open the upload page. Just upload the video and paste your caption!
              </p>

              <div className="space-y-3">
                {PLATFORMS.map((platform) => {
                  const Icon = platform.icon;
                  const isCopied = copiedStates[platform.id];

                  return (
                    <button
                      key={platform.id}
                      onClick={() => handlePlatformAction(platform)}
                      disabled={platform.id === 'youtube' && uploadState.isUploading}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-950 transition-all duration-200 group hover:border-slate-600 ${platform.bgHover} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-lg bg-slate-900 border ${platform.borderColor}`}>
                          <Icon size={24} className={`${platform.color} group-hover:scale-110 transition-transform`} />
                        </div>
                        <span className="font-semibold text-white">{platform.name}</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {platform.id === 'youtube' ? (
                          uploadState.isUploading ? (
                            <span className="flex items-center text-xs font-medium text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-full">
                              <Loader2 size={14} className="mr-1 animate-spin" /> {uploadState.status}
                            </span>
                          ) : (
                            <span className="flex items-center text-xs font-medium text-slate-400 bg-slate-800 px-3 py-1.5 rounded-full group-hover:text-white transition-colors">
                              <UploadCloud size={14} className="mr-1" /> One-Click Push
                            </span>
                          )
                        ) : isCopied ? (
                          <span className="flex items-center text-xs font-medium text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full">
                            <CheckCircle2 size={14} className="mr-1" /> Copied!
                          </span>
                        ) : (
                          <span className="flex items-center text-xs font-medium text-slate-400 bg-slate-800 px-3 py-1.5 rounded-full group-hover:text-white transition-colors">
                            <Copy size={14} className="mr-1" /> Copy & Open <ExternalLink size={12} className="ml-1 opacity-50" />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
