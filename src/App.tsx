import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Database,
  MapPin,
  Stethoscope,
  Activity,
  Sparkles,
  Trash2,
  RefreshCw,
  User,
  HeartPulse,
  Scale,
  Shield,
  Loader2,
  Map,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  AlertCircle,
  ArrowRight
} from "lucide-react";
import { Message, UserData, VoiceSettings } from "./types";

const INITIAL_MESSAGES: Message[] = [
  {
    id: "welcome-msg",
    role: "model",
    text: "Healthy day! I am your supportive **Empathetic Health Assistant**. I can look up your medical records, check your medications, or help you locate nearby clinics using map grounding tools.\n\n*Please remember: I am an interactive assistant and do not substitute for a physical diagnosis or absolute medical advice.*",
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    actionType: "general_conversation"
  }
];

// Visual subcomponent to parse text syntax (e.g. **bold**, *italic*) and strip raw astierisks
function parseTextLine(line: string) {
  const tokenRegex = /(\*\*.*?\*\*|\*.*?\*)/g;
  const rawParts = line.split(tokenRegex);
  
  return rawParts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
    } else if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i} className="italic text-slate-700">{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function FormattedMessage({ text }: { text: string }) {
  const lines = text.split("\n");
  
  return (
    <div className="space-y-1.5 text-slate-800">
      {lines.map((line, lineIdx) => {
        const cleanLine = line.trim();
        
        // Handle markdown lists starting with bullet points
        const isBullet = cleanLine.startsWith("- ") || cleanLine.startsWith("* ");
        const isNumbered = /^\d+\.\s/.test(cleanLine);
        
        if (isBullet) {
          // Remove list markers (- or *)
          const content = cleanLine.replace(/^[-*]\s+/, "");
          return (
            <div key={lineIdx} className="flex items-start gap-2.5 pl-1 my-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-2 shrink-0" />
              <span className="flex-1 min-w-0 text-slate-800">{parseTextLine(content)}</span>
            </div>
          );
        }
        
        if (isNumbered) {
          const match = cleanLine.match(/^(\d+)\.\s+(.*)/);
          if (match) {
            const num = match[1];
            const content = match[2];
            return (
              <div key={lineIdx} className="flex items-start gap-2.5 pl-1 my-1">
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full w-4.5 h-4.5 flex items-center justify-center shrink-0 mt-0.5">
                  {num}
                </span>
                <span className="flex-1 min-w-0 pt-0.5 text-slate-800">{parseTextLine(content)}</span>
              </div>
            );
          }
        }
        
        if (!cleanLine) {
          return <div key={lineIdx} className="h-2" />;
        }
        
        return (
          <p key={lineIdx} className="leading-relaxed">
            {parseTextLine(line)}
          </p>
        );
      })}
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [currentInput, setCurrentInput] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  // Speech synthesis states
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    autoSpeak: true,
    rate: 0.95,
    pitch: 1.0,
  });
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  
  // Speech recognition states
  const [isListening, setIsListening] = useState<boolean>(false);
  const [sttSupported, setSttSupported] = useState<boolean>(true);
  const [sttError, setSttError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  
  // Secure Database Simulator (sent dynamically on tool requested)
  const [userData, setUserData] = useState<UserData>({
    name: "John Doe",
    history: "Essential Hypertension, Mild Seasonal Asthma, Penicillin Allergy",
    meds: "Lisinopril 10mg daily, Albuterol inhaler (as needed)",
    location: "Brooklyn, New York"
  });

  const [isDetectingLocation, setIsDetectingLocation] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  const [activeFacilityMap, setActiveFacilityMap] = useState<{
    query: string;
    location: string;
    show: boolean;
  } | null>(null);

  const [joinedCampaigns, setJoinedCampaigns] = useState<string[]>([]);
  const [isFallbackMode, setIsFallbackMode] = useState<boolean>(false);
  const [selectedClinicMap, setSelectedClinicMap] = useState<Record<string, number>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Attempt to locate user's physical presence (Country/City context)
  const detectUserLocation = async (manual = false) => {
    setIsDetectingLocation(true);
    setLocationError(null);
    
    // Attempt IP-based lookup first, as it is non-blocking and works beautifully in frame sandboxes
    try {
      const response = await fetch("https://ipapi.co/json/");
      if (response.ok) {
        const data = await response.json();
        if (data.city && data.country_name) {
          const matchedLocation = `${data.city}, ${data.region_code || data.region || ""}, ${data.country_name}`.replace(/,\s*,/, ",");
          setUserData(prev => ({
            ...prev,
            location: matchedLocation
          }));
          setIsDetectingLocation(false);
          return;
        }
      }
    } catch (err) {
      console.warn("IP-based localization failed, attempting Geolocation sensor:", err);
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const geocodeRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
            if (geocodeRes.ok) {
              const geocodeData = await geocodeRes.json();
              const formatted = `${geocodeData.city || geocodeData.locality || ""}, ${geocodeData.principalSubdivision || ""}, ${geocodeData.countryName || ""}`.replace(/^,\s*|,\s*$/g, "").replace(/,\s*,/g, ",");
              if (formatted.trim()) {
                setUserData(prev => ({ ...prev, location: formatted }));
                setIsDetectingLocation(false);
                return;
              }
            }
          } catch (geocodeErr) {
            console.warn("Geocode reverse coordinates failed:", geocodeErr);
          }
          // Fallback to literal coordinate display
          setUserData(prev => ({ ...prev, location: `${latitude.toFixed(4)} N, ${longitude.toFixed(4)} E` }));
          setIsDetectingLocation(false);
        },
        (error) => {
          console.warn("Sensor Geolocation error:", error);
          if (manual) {
            setLocationError("Location authorization was declined or unavailable.");
          }
          setIsDetectingLocation(false);
        },
        { enableHighAccuracy: false, timeout: 6000 }
      );
    } else {
      if (manual) {
        setLocationError("Navigation Sensor not supported by browser.");
      }
      setIsDetectingLocation(false);
    }
  };

  // Run location detection on mount
  useEffect(() => {
    detectUserLocation(false);
  }, []);

  // Initialize Speech Synthesis and Recognition
  useEffect(() => {
    if (!window.speechSynthesis) {
      setSpeechSupported(false);
    }
    
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setSttSupported(false);
    } else {
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";
      
      rec.onstart = () => {
        setIsListening(true);
      };
      
      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setCurrentInput(transcript);
          handleSubmitMessage(transcript);
        }
      };
      
      rec.onerror = (e: any) => {
        console.warn("STT Error:", e);
        setIsListening(false);
      };
      
      rec.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current = rec;
    }
    
    // Stop speaking on unmount
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Scroll to bottom of chat thread on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  // Handle Speech synthesis vocalization
  const speakText = (text: string) => {
    if (!window.speechSynthesis || !voiceSettings.autoSpeak) return;
    
    try {
      window.speechSynthesis.cancel();
      
      // Clear markdown tokens (*, **, #, ` etc) for cleaner vocal sound
      const cleaned = text
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/#/g, "")
        .replace(/`/g, "")
        .replace(/-\s+/g, "")
        .replace(/\[(.*?)\]\(.*?\)/g, "$1")
        .trim();
        
      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.rate = voiceSettings.rate;
      utterance.pitch = voiceSettings.pitch;
      
      // Auto selecting an English speaking voice
      const voices = window.speechSynthesis.getVoices();
      const matchVoice = voices.find(
        v => v.lang.startsWith("en-") && (v.name.includes("Google") || v.name.includes("Natural"))
      ) || voices.find(v => v.lang.startsWith("en-")) || voices[0];
      
      if (matchVoice) {
        utterance.voice = matchVoice;
      }
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("TTS speaking error:", err);
      setIsSpeaking(false);
    }
  };

  const handleStopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Microphone toggle button
  const toggleListening = async () => {
    setSttError(null);
    if (!sttSupported) {
      setSttError("Web Speech Recording API is not supported in this frame environment. Please type your query in the input box.");
      return;
    }
    
    handleStopSpeaking();
    
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch (err) {
        console.warn("Speech stop warning:", err);
      }
      setIsListening(false);
    } else {
      try {
        // Request active browser microphone stream permission to trigger browser prompt reliably
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        recognitionRef.current?.start();
      } catch (err: any) {
        console.error("Microphone permissions or API start failed:", err);
        if (err.name === "NotAllowedError" || err.message?.includes("denied")) {
          setSttError("Microphone authorization was declined or blocked by iframe permissions. Please check your browser address bar parameters.");
        } else {
          setSttError("Unable to initialize microphone. Make sure it is not in use by another request.");
        }
        setIsListening(false);
      }
    }
  };

  // Submit message to the local node server
  const handleSubmitMessage = async (overrideText?: string) => {
    const textToSend = (overrideText || currentInput).trim();
    if (!textToSend || isProcessing) return;
    
    setCurrentInput("");
    handleStopSpeaking();
    
    const userMsg: Message = {
      id: "msg-" + Date.now(),
      role: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);
    
    try {
      // Map state messages history into format standard Gemini uses on express server:
      // [{ role: 'user' | 'model', parts: [{ text: string }] }]
      const apiHistory = messages.map(m => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.text }]
      }));
      
      const response = await fetch("/api/health-agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          history: apiHistory,
          message: textToSend,
          userData: userData
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Communication failed.");
      }
      
      const resData = await response.json();
      
      if (resData.isFallbackMode) {
        setIsFallbackMode(true);
      } else {
        setIsFallbackMode(false);
      }
      
      const agentMsg: Message = {
        id: "msg-agent-" + Date.now(),
        role: "model",
        text: resData.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionType: resData.actionType,
        toolResult: resData.toolResult,
        functionCalled: resData.functionCalled,
        functionArgs: resData.functionArgs
      };
      
      setMessages(prev => [...prev, agentMsg]);
      
      // If maps tool was chosen, visualize the facility grounding banner!
      if (resData.functionCalled === "openFacilityMaps" && resData.toolResult) {
        setActiveFacilityMap({
          query: resData.toolResult.query,
          location: resData.toolResult.location || userData.location,
          show: true
        });
      }
      
      // Speak the back response aloud
      speakText(resData.text);
      
    } catch (err: any) {
      console.error("Agent chat exception (Transitioning to Client-Side Resilient Mode):", err);
      setIsFallbackMode(true);
      
      const lowerInput = textToSend.toLowerCase();
      let offlineText = "";
      let fallbackCall: string | undefined = undefined;
      let fallbackArgs: any = undefined;
      let fallbackResult: any = undefined;
      let fallbackAction: "database_lookup" | "map_grounding" | "general_conversation" = "general_conversation";

      const userLoc = userData?.location || "Brooklyn, New York";

      if (lowerInput.includes("emergency") || lowerInput.includes("chest pain") || lowerInput.includes("911")) {
        offlineText = `🚨 **URGENT EMERGENCY RESPONSE REQUIRED** 🚨\n\nBased on your described symptoms, you might be facing a life-threatening medical situation. **Please call 911 (or your local emergency number in ${userLoc}) immediately, or proceed to the nearest emergency room.**\n\nI have automatically centered our visual locator widget below on **"Emergency Rooms"** in **${userLoc}** to assist your immediate transit. Please do not wait. Your physical safety is the absolute highest priority.`;
        fallbackCall = "openFacilityMaps";
        fallbackArgs = { query: "Emergency Room / Hospital", location: userLoc };
        fallbackResult = {
          status: "Display maps recommendation for Emergency Room / Hospital",
          query: "Emergency Room / Hospital",
          location: userLoc
        };
        fallbackAction = "map_grounding";
      } else if (lowerInput.includes("hospital") || lowerInput.includes("clinic") || lowerInput.includes("pharmacy") || lowerInput.includes("doctor") || lowerInput.includes("map")) {
        let qType = "General Clinic / Medical Center";
        if (lowerInput.includes("pharmacy") || lowerInput.includes("chemist")) qType = "Pharmacy";
        else if (lowerInput.includes("urgent care")) qType = "Urgent Care Clinic";
        else if (lowerInput.includes("pediatrician")) qType = "Pediatrician";

        offlineText = `🗺️ **Local Facility Navigation Connected**\n\nI have initialized our spatial map locator under secure offline fallback parameters. Nearby recommendations for **"${qType}"** centered around your location of **"${userLoc}"** have been pinned in the visual interactive map container below.\n\n*Click on any pin coordinates to load direct walking or driving directions.*`;
        fallbackCall = "openFacilityMaps";
        fallbackArgs = { query: qType, location: userLoc };
        fallbackResult = {
          status: "Display maps recommendation for " + qType,
          query: qType,
          location: userLoc
        };
        fallbackAction = "map_grounding";
      } else if (lowerInput.includes("history") || lowerInput.includes("medication") || lowerInput.includes("allergic") || lowerInput.includes("record")) {
        offlineText = `📋 **Secure Medical History Retrieved**\n\nI have retrieved your medical parameters from our offline-cached client database profiles for user **${userData?.name || "John Doe"}**:\n\n• **Chronic Illnesses/History**: ${userData?.history || "No chronic medical history logged"}\n• **Active Medications**: ${userData?.meds || "No prescription medications logged"}\n\n*Because of your registered conditions, you have an excellent fit for our reward-optimized wellness campaigns. Scan or request 'campaigns' to view.*`;
        fallbackCall = "getUserHistory";
        fallbackArgs = {};
        fallbackResult = {
          user: {
            name: userData?.name || "John Doe",
            history: userData?.history || "No chronic medical history logged",
            meds: userData?.meds || "No prescription medications logged"
          }
        };
        fallbackAction = "database_lookup";
      } else if (lowerInput.includes("campaign") || lowerInput.includes("challenge") || lowerInput.includes("reward") || lowerInput.includes("points")) {
        offlineText = `🎁 **Wellness Incentives Directory Opened**\n\nI have fetched our current system wellness campaigns and tangible incentives under resilient offline parameters. Here are the active challenges you are eligible to join directly:\n\n1. **Cardio-Shield Steps Challenge**: Intended for heart rate and blood pressure maintenance. Walk 6,000 steps daily. **Reward: 500 Wellness Points** ($5 prescription copay deduction voucher).\n2. **Asthmawise Breathing Log**: Intended to track bronchial and coughing triggers. Complete daily logs. **Reward: Free peak-flow meter instrument / spacer**.\n3. **Mindful Minutes Stress Reduction**: Log 10 minutes of tactical box-breathing. **Reward: Organic loose-leaf wellness tea sampler**.\n\nYou can click **"Join Challenge"** on any of the program cards underneath to activate logging, claim points, and earn physical wellness rewards!`;
        fallbackCall = "getHealthCampaigns";
        fallbackArgs = {};
        fallbackResult = {
          status: "Successfully pulled active system health campaigns",
          campaigns: [
            {
              id: "camp-cardio-shield",
              title: "Cardio-Shield Steps Challenge",
              description: "Daily gentle walks designed to support cardiovascular strength, optimize volume load, and target blood vessel health.",
              targetTopic: "Hypertension, Blood Pressure, Heart rate, Exercise, Cardio, Circulation, BP",
              importance: "Particularly recommended for managing high blood pressure and promoting healthy regular circulation.",
              incentive: "500 Wellness Points ($5 equivalent prescription or medication copay deduction voucher).",
              healthyPractice: "Walk 6,000 steps daily combined with regular timed hydration checkmarks."
            },
            {
              id: "camp-asthma-diary",
              title: "Asthmawise Breathing Log & Trigger Diary",
              description: "Enhance respiratory volume, recognize seasonal or environmental bronchial triggers, and log medication intervals.",
              targetTopic: "Asthma, Lung capacity, Cough, Pulmonary, Bronchitis, Allergies, Inhaler",
              importance: "Particularly recommended for alleviating pulmonary breathing stress and cataloging daily inhaler routines.",
              incentive: "A durable peak-flow meter instrument or a clinical inhaler spacer sleeve, hand-delivered to your door for free.",
              healthyPractice: "Complete a daily 2-minute respiratory questionnaire and review allergen forecasts."
            },
            {
              id: "camp-mindful-minutes",
              title: "Mindful Minutes Stress & Cortisol Reduction Campaign",
              description: "Optimized autonomic quiet box-breathing schedules to decrease cellular cortisol, drop heart rate spikes, and maximize HRV.",
              targetTopic: "Stress, Tension, Anxiety, Sleeplessness, Relaxation, Mental wellness, Fatigue, Sleep",
              importance: "Highly recommended for overall nervous system alignment or for lowering symptom-induced adrenaline.",
              incentive: "An organic loose-leaf herbal relaxation tea sampler plus one month of premium guided vagal nerve audio streams.",
              healthyPractice: "Engage in 10 minutes of box-breathing or visual biofeedback pacing per day."
            }
          ]
        };
        fallbackAction = "database_lookup";
      } else if (lowerInput.includes("blood pressure") || lowerInput.includes("hypertension") || lowerInput.includes(" bp ") || lowerInput.includes("cardio") || lowerInput.includes("heart")) {
        offlineText = `🩺 **Hypertension & Blood Pressure Care Program Guide**\n\nMaintaining balanced systemic blood pressure relies on small daily practices. Under offline wellness guidance, prioritize these standard parameters:\n\n1. **Sodium Restructuring**: Keep sodium intake strictly below 1,500mg daily (avoid pre-packaged process ingredients).\n2. **Aerobic Endurance**: Engage in moderate aerobics such as a 30-minute daily gentle walk to optimize blood vessel flexibility.\n3. **Regular hydration**: Aim for 8-10 glasses of water, scheduling standard reminders.\n\n🏆 **Active Reward Opportunity**: We highly recommend enrolling in our **Cardio-Shield Steps Challenge**! By linking a regular 6,000 steps daily target, you'll earn **500 Wellness Points ($5 medication copay discount voucher)**! You can request 'load campaigns' to join.`;
      } else if (lowerInput.includes("asthma") || lowerInput.includes("lung") || lowerInput.includes("cough") || lowerInput.includes("breath") || lowerInput.includes("pulmonary") || lowerInput.includes("bronch") || lowerInput.includes("inhaler") || lowerInput.includes("allerg")) {
        offlineText = `🫁 **Asthma & Respiratory Wellness Protocol**\n\nManaging reactive airways and maintaining peak lung volume involves strategic triggers identification:\n\n1. **Chronological Trigger Diary**: Log seasonal allergen counts, dramatic temperature drops, dust exposure, or coughing intervals.\n2. **Inhaler spacer utilization**: Administer rescue or control inhalers using a chamber/spacer device. This ensures complete aerosol particle penetration deep into bronchial walls rather than just hitting the throat.\n3. **Controlled box-breathing**: Pace autonomic anxiety-induced breathing lock.\n\n🏆 **Active Reward Opportunity**: Enroll in our **Asthmawise Breathing Log & Trigger Diary**! By logging your daily parameters and allergen conditions, you earn a **free durable peak-flow meter instrument** or a spacer spacer chamber delivered straight to your door!`;
      } else if (lowerInput.includes("stress") || lowerInput.includes("tension") || lowerInput.includes("anxiet") || lowerInput.includes("sleep") || lowerInput.includes("insomnia") || lowerInput.includes("fatigue") || lowerInput.includes("relax")) {
        offlineText = `🧘 **Stress, Cortisol, & Vagal Nerve Quiet Protocol**\n\nAutonomic regulation can quickly align heart rate variability and drop adrenaline spikes. Try these routines:\n\n1. **Autonomic Quiet Box-Breathing**: Use the box-breathing method: inhale for 4s, hold for 4s, exhale for 4s, hold for 4s. Repeat for 10 minutes to rapidly shut off central adrenaline.\n2. **Melatonin protection**: Restrict high-intensity screens, caffeine, and blue light past 2:00 PM to assist natural circadian sleep rhythms.\n\n🏆 **Active Reward Opportunity**: Enroll in our **Mindful Minutes Stress & Cortisol Reduction Campaign**! Logging 10 minutes of daily quiet autonomic pacing yields an **organic loose-leaf relaxation tea sampler** delivered straight to you!`;
      } else {
        offlineText = `👋 **Resilient Offline Healing Assistance Active**\n\nOur system connection is running in offline recovery mode. Although some complex cloud services are currently unavailable, my local nurse knowledge system is here of service!\n\nI can assist you to:\n• **Check Database history**: Ask me *"What medications am I taking?"* or *"Load medical history"*\n• **Find local medical centres**: Ask me *"Find an urgent care near me"*\n• **Review wellness campaigns**: Ask me *"What challenges are active"* to start daily healthy habits and earn points!\n\nFeel free to write your query, and we will safely guide you!`;
      }

      const backupMsg: Message = {
        id: "msg-agent-offline-" + Date.now(),
        role: "model",
        text: offlineText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionType: fallbackAction,
        toolResult: fallbackResult,
        functionCalled: fallbackCall,
        functionArgs: fallbackArgs
      };

      setMessages(prev => [...prev, backupMsg]);

      if (fallbackCall === "openFacilityMaps" && fallbackResult) {
        setActiveFacilityMap({
          query: fallbackResult.query,
          location: fallbackResult.location || userData.location,
          show: true
        });
      }

      speakText(offlineText);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearChat = () => {
    handleStopSpeaking();
    setMessages(INITIAL_MESSAGES);
    setActiveFacilityMap(null);
  };

  const resetUserData = () => {
    setUserData({
      name: "John Doe",
      history: "Essential Hypertension, Mild Seasonal Asthma, Penicillin Allergy",
      meds: "Lisinopril 10mg daily, Albuterol inhaler (as needed)",
      location: "Brooklyn, New York"
    });
  };

  // Built-in prompt suggest vectors
  const suggestions = [
    {
      label: "Check My Database Habits",
      prompt: "Can you list my medical history conditions and current medications from my profile?",
      icon: Database,
      color: "bg-emerald-50 text-emerald-700 border-emerald-100"
    },
    {
      label: "Find Local Care Clinic",
      prompt: "I am feeling mild asthma chest tightness. Where is the nearest urgent care center?",
      icon: MapPin,
      color: "bg-blue-50 text-blue-700 border-blue-101"
    },
    {
      label: "Wellness Programs & Rewards",
      prompt: "What active health campaigns and reward incentives are running that I can join?",
      icon: Sparkles,
      color: "bg-orange-50 text-orange-700 border-orange-100"
    }
  ];

  // Visual simulation for nearby healthcare units when Google Maps is parsed
  const getSimulatedClinics = (query: string, location: string) => {
    const isPharmacy = query.toLowerCase().includes("pharmac") || query.toLowerCase().includes("drug");
    const isDoctor = query.toLowerCase().includes("doc") || query.toLowerCase().includes("specialist") || query.toLowerCase().includes("pediat");
    
    if (isPharmacy) {
      return [
        { name: "First Choice Pharmacy", address: `524 Medical Plaza Way, ${location}`, dist: "0.4 miles", open: "Open 24/7", tel: "(718) 555-0192" },
        { name: "Community Health Pharmacy & RX", address: `88 Vanderbilt Blvd, ${location}`, dist: "1.2 miles", open: "Closes at 9:00 PM", tel: "(718) 555-0144" },
      ];
    } else if (isDoctor) {
      return [
        { name: "Downtown Family Medicine & Specialists", address: `104 Flatbush Ave Suite B, ${location}`, dist: "1.1 miles", open: "Requires appointment", tel: "(718) 555-4422" },
        { name: "Metro Health Care Practitioners", address: `612 Fulton Dr, ${location}`, dist: "1.8 miles", open: "Accepts Walk-ins", tel: "(718) 555-8833" },
      ];
    } else {
      // Urgent care / Emergency general
      return [
        { name: "City Care urgent Health Center", address: `340 Atlantic Ave, ${location}`, dist: "0.6 miles", open: "Open - Closes at 11:00 PM", tel: "(718) 555-9000", badge: "Cardio-Safe Enabled" },
        { name: "Mercy General Hospital Emergency Room", address: `55 Clark St, ${location}`, dist: "1.5 miles", open: "Open 24/7", tel: "(718) 555-3321", badge: "Level 1 Trauma" },
      ];
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
      {/* HEADER BANNER */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-xs px-4 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="relative p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
              <HeartPulse className="w-6 h-6 animate-pulse" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display tracking-tight text-slate-900 flex flex-wrap items-center gap-2">
                AfyaPochi
                {isFallbackMode ? (
                  <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1 border border-amber-200">
                    <AlertTriangle className="w-3 h-3 text-amber-600 animate-pulse" /> Offline Resilient Mode
                  </span>
                ) : (
                  <span className="text-xs font-normal text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1.5 border border-emerald-100">
                    <Activity className="w-3 h-3 animate-pulse" /> Live Server API
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Empathetic Health Assistant with secure database lookups and local physical mapping tools.
              </p>
            </div>
          </div>

          {/* Emergency Alert Widget in Head */}
          <div className="flex items-center gap-3 bg-red-50 border border-red-100 px-4 py-2 rounded-lg text-xs font-semibold text-red-800">
            <AlertTriangle className="w-4 h-4 text-red-600 animate-bounce shrink-0" />
            <div>
              <span className="font-bold">Medical Emergency? </span>
              <span className="font-normal text-red-700">If you experience severe pain or breathlessness, call 911 immediately.</span>
            </div>
          </div>

        </div>
      </header>

      {/* BODY CONTENT GRID */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: SIMULATORS AND CONTROLS (cols 1-4) */}
        <section id="simulator-rail" className="lg:col-span-4 flex flex-col gap-6">
          
          {/* PROFILE DB SIMULATOR CARD */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-800">
                <Database className="w-4 h-4 text-emerald-600" />
                <h2 className="font-bold font-display text-sm tracking-tight">App Database Simulator</h2>
              </div>
              <button 
                onClick={resetUserData}
                title="Reset simulation context"
                className="text-xs text-slate-400 hover:text-emerald-700 transition flex items-center gap-1.5 font-semibold"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>

            <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
              ⚡ This simulator replicates the live health application database. Ask the agent things like "What medications do I take?" to trigger real tool calls.
            </p>

            <div className="space-y-3.5 mt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Patient Profile Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    value={userData.name}
                    onChange={e => setUserData({...userData, name: e.target.value})}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-emerald-600 bg-slate-50/50"
                    placeholder="e.g. John Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Chronic Records & History
                </label>
                <textarea 
                  rows={2}
                  value={userData.history}
                  onChange={e => setUserData({...userData, history: e.target.value})}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-emerald-600 bg-slate-50/50 resize-none font-sans"
                  placeholder="e.g. Hypertension, Diabetes, Asthma"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Registered Medications
                </label>
                <input 
                  type="text" 
                  value={userData.meds}
                  onChange={e => setUserData({...userData, meds: e.target.value})}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-emerald-600 bg-slate-50/50"
                  placeholder="e.g. Lisinopril 10mg daily"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Zip/City Location
                  </label>
                  <button
                    type="button"
                    onClick={() => detectUserLocation(true)}
                    disabled={isDetectingLocation}
                    className="text-[10px] text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 font-semibold disabled:opacity-55"
                  >
                    {isDetectingLocation ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-emerald-600" /> Locating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-2.5 h-2.5" /> Locate Me
                      </>
                    )}
                  </button>
                </div>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    value={userData.location}
                    onChange={e => setUserData({...userData, location: e.target.value})}
                    className="w-full pl-9 pr-9 py-2 text-xs border border-slate-200 rounded-lg focus:outline-emerald-600 bg-slate-50/50"
                    placeholder="e.g. Brooklyn, NY"
                  />
                  {isDetectingLocation && (
                    <div className="absolute right-3 top-2.5">
                      <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                    </div>
                  )}
                </div>
                {locationError && (
                  <p className="text-[10px] text-rose-600 mt-1 font-medium">{locationError}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-emerald-50/20 px-3 py-2 rounded-lg border border-emerald-50 mt-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Database synced dynamically to health agent context.</span>
            </div>
          </div>

          {/* AUDIO SYNTHESIS & ACCESS CONTROLS TYPE */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col gap-4">
            <h3 className="font-bold font-display text-sm pb-2 border-b border-slate-100 text-slate-800 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-emerald-600" /> Voice Assistant Settings
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-xs font-bold text-slate-700">Text-to-Speech (TTS)</span>
                  <span className="text-[10px] text-slate-400">Speak generated feedback aloud</span>
                </div>
                <button
                  onClick={() => setVoiceSettings(prev => ({...prev, autoSpeak: !prev.autoSpeak}))}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1 ${
                    voiceSettings.autoSpeak 
                      ? "bg-emerald-600 text-white" 
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {voiceSettings.autoSpeak ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  {voiceSettings.autoSpeak ? "Active" : "Silenced"}
                </button>
              </div>

              {voiceSettings.autoSpeak && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>Vocalization Rate (Speed)</span>
                      <span className="font-mono text-slate-700">{voiceSettings.rate}x</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.7" 
                      max="1.3" 
                      step="0.05"
                      value={voiceSettings.rate}
                      onChange={e => setVoiceSettings({...voiceSettings, rate: parseFloat(e.target.value)})}
                      className="w-full accent-emerald-600 cursor-pointer h-1 bg-slate-200 rounded-lg"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>Vocalization Pitch</span>
                      <span className="font-mono text-slate-700">{voiceSettings.pitch}x</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.8" 
                      max="1.2" 
                      step="0.05"
                      value={voiceSettings.pitch}
                      onChange={e => setVoiceSettings({...voiceSettings, pitch: parseFloat(e.target.value)})}
                      className="w-full accent-emerald-600 cursor-pointer h-1 bg-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {isSpeaking && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs text-emerald-800 font-semibold">Speaking response aloud...</span>
                  </div>
                  <button 
                    onClick={handleStopSpeaking}
                    className="text-[10px] uppercase font-bold tracking-wider text-emerald-800 hover:underline"
                  >
                    Mute
                  </button>
                </div>
              )}

              {!speechSupported && (
                <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-100 text-[11px] text-amber-800">
                  ⚠️ Speech synthesis is restricted by this frame container. We suggest opening this applet on a new tab.
                </div>
              )}
            </div>
          </div>

          {/* ACTIVE WELLNESS REWARDS PANEL */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold font-display text-sm text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" /> Active Wellness Rewards
              </h3>
              <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                Streak: {joinedCampaigns.length > 0 ? "1 Daily Log" : "0"}
              </span>
            </div>

            {joinedCampaigns.length === 0 ? (
              <div className="text-center py-4 px-2 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="block text-[22px] mb-1">🎁</span>
                <span className="block text-xs font-bold text-slate-700">Incentives Program Loading</span>
                <span className="block text-[10px] text-slate-400 mt-1 leading-relaxed">
                  Join a healthy practice challenge during chat. Perform daily tasks to earn points & medication copay vouchers!
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {joinedCampaigns.map(id => {
                  const details = id === "camp-cardio-shield" 
                    ? { title: "Cardio-Shield Steps", task: "6,000 steps daily", reward: "500 Points ($5 copay deduction)" }
                    : id === "camp-asthma-diary"
                    ? { title: "Asthmawise Breathing Log", task: "Daily allergen monitoring", reward: "Free physical spacer shipped" }
                    : { title: "Mindful Minutes stressless", task: "10 mins breathing biofeedback", reward: "Wellness tea sampler ($15 value)" };

                  return (
                    <div key={id} className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-xl flex flex-col gap-1.5 text-xs">
                      <div className="flex justify-between items-center bg-white px-2 py-1 rounded border border-emerald-100/60 font-bold text-emerald-800">
                        <span className="truncate">{details.title}</span>
                        <span className="text-[9px] bg-emerald-700 text-white px-1.5 py-0.2 rounded shrink-0 uppercase tracking-wider font-mono">ACTIVE</span>
                      </div>
                      <div className="space-y-0.5 text-[11px] text-slate-600 px-1">
                        <div>• <span className="font-bold">Practice:</span> {details.task}</div>
                        <div>• <span className="font-bold text-emerald-700">Incentive:</span> {details.reward}</div>
                      </div>
                    </div>
                  );
                })}
                <div className="text-[10px] text-center text-slate-400 italic pt-1 flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" /> Keep logging daily practice parameters to claim!
                </div>
              </div>
            )}
          </div>

          {/* DYNAMIC PROMPT SUGGEST PANEL */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col gap-3">
            <h3 className="font-bold font-display text-sm text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" /> Suggested Test Scenarios
            </h3>
            <p className="text-xs text-slate-500">Click any of the cases below to automatically run the agent test sequence:</p>
            
            <div className="flex flex-col gap-2.5 mt-1">
              {suggestions.map((s, idx) => {
                const IconComp = s.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setCurrentInput(s.prompt);
                      handleSubmitMessage(s.prompt);
                    }}
                    disabled={isProcessing}
                    className={`text-left p-3 rounded-xl border transition text-slate-700 flex gap-2.5 items-start bg-slate-50/50 hover:bg-slate-50 border-slate-200 outline-hidden hover:border-slate-300 disabled:opacity-50`}
                  >
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block text-xs font-bold text-slate-800">{s.label}</span>
                      <span className="block text-[11px] text-slate-500 truncate mt-0.5">"{s.prompt}"</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </section>

        {/* RIGHT COLUMN: CORE CONVERSATION CONSOLE (cols 5-12) */}
        <section id="chat-workspace" className="lg:col-span-8 flex flex-col h-[calc(100vh-140px)] min-h-[500px]">
          
          {/* CONSOLE CASING */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col relative">
            
            {/* CONSOLE STATE HEADER */}
            <div className="px-5 py-3.5 bg-slate-50/60 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isProcessing ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isProcessing ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                </span>
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  {isProcessing ? "Agent reasoning..." : isListening ? "Voice Listening..." : "Agent Standing By"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={clearChat}
                  title="Clear chat records"
                  className="p-1 px-2.5 text-xs text-slate-500 hover:text-red-600 rounded-lg hover:bg-slate-100 flex items-center gap-1 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear Logs
                </button>
              </div>
            </div>

            {/* MESSAGES VIEWPORT */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <AnimatePresence initial={false}>
                {messages.map((m) => {
                  const isUser = m.role === "user";
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3.5 ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      {/* Avatar */}
                      {!isUser && (
                        <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl h-10 w-10 flex items-center justify-center shrink-0 shadow-xs">
                          <Stethoscope className="w-5 h-5" />
                        </div>
                      )}

                      {/* Msg bubble container */}
                      <div className={`p-4 rounded-2xl max-w-[82%] text-slate-800 text-sm leading-relaxed ${
                        isUser 
                          ? "bg-slate-900 text-white rounded-tr-none px-4.5" 
                          : "bg-slate-50 border border-slate-200/80 rounded-tl-none"
                      }`}>
                        
                        {/* System telemetry label when tool is triggered */}
                        {m.functionCalled && (
                          <div className="mb-2.5 flex flex-wrap gap-1.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wide bg-emerald-100 text-emerald-800 flex items-center gap-1 border border-emerald-200 shadow-2xs">
                              <Database className="w-3 h-3" /> Tool Invocation: {m.functionCalled}
                            </span>
                            {m.actionType && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-blue-100 text-blue-800 border border-blue-200">
                                ⚙️ {m.actionType.replace("_", " ")}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Preprocessed Message body */}
                        <div className="prose max-w-none">
                          <FormattedMessage text={m.text} />
                        </div>

                        {/* Tool triggered special map visual simulator */}
                        {m.functionCalled === "openFacilityMaps" && m.toolResult && (
                          (() => {
                            const clinicsList = getSimulatedClinics(m.toolResult.query, m.toolResult.location || userData.location);
                            const selectedClinicIdx = selectedClinicMap[m.id] ?? 0;
                            const activeSelectedClinic = clinicsList[selectedClinicIdx] || clinicsList[0] || null;
                            const mapSearchQuery = activeSelectedClinic 
                              ? `${activeSelectedClinic.name}, ${activeSelectedClinic.address}`
                              : `${m.toolResult.query || ""} ${m.toolResult.location || userData.location}`;
                            
                            return (
                              <div className="mt-4 border-t border-slate-200 pt-4 flex flex-col gap-3">
                                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                                  <span className="flex items-center gap-2">
                                    <Map className="w-4 h-4 text-emerald-600 animate-pulse" />
                                    Interactive Local Map: Near {m.toolResult.location || userData.location}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono tracking-wide">Zoom & Drag Enabled</span>
                                </div>

                                {/* Interactive Embed Live Google Map */}
                                <div className="relative w-full rounded-xl overflow-hidden border border-slate-250/90 shadow-sm bg-slate-100">
                                  <iframe
                                    id={`map-iframe-${m.id}`}
                                    title="Local Healthcare Map"
                                    src={`https://maps.google.com/maps?q=${encodeURIComponent(mapSearchQuery)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                                    width="100%"
                                    height="280"
                                    className="border-0 block w-full outline-hidden"
                                    allowFullScreen
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                  ></iframe>
                                </div>
                                
                                <div className="text-xs text-slate-500 font-medium px-1 flex items-center gap-1">
                                  <span>👇 Click/Tap a clinic block to pin and target it on the map container:</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1 font-sans">
                                  {clinicsList.map((cli, i) => {
                                    const isSelected = selectedClinicIdx === i;
                                    return (
                                      <div 
                                        key={i} 
                                        onClick={() => setSelectedClinicMap(prev => ({ ...prev, [m.id]: i }))}
                                        className={`p-3 rounded-xl cursor-pointer transition-all duration-200 flex flex-col gap-1.5 text-xs select-none ${
                                          isSelected 
                                            ? "bg-emerald-50/75 border-2 border-emerald-500 shadow-xs ring-2 ring-emerald-500/10" 
                                            : "bg-white border border-slate-200 hover:border-slate-350 hover:bg-slate-50/50"
                                        }`}
                                      >
                                        <div className="flex justify-between items-start gap-1">
                                          <span className="font-bold text-slate-900 truncate flex items-center gap-1">
                                            {isSelected && <span className="text-emerald-600 shrink-0">📌</span>}
                                            {cli.name}
                                          </span>
                                          <span className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded shrink-0 ${
                                            isSelected ? "bg-emerald-100 text-emerald-800" : "bg-emerald-50 text-emerald-700"
                                          }`}>{cli.dist}</span>
                                        </div>
                                        <span className="text-[11px] text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0" /> {cli.address}</span>
                                        <div className="flex items-center justify-between text-[11px] mt-1 pt-1.5 border-t border-slate-100 text-slate-400">
                                          <span className={isSelected ? "text-emerald-700 font-medium" : ""}>{cli.open}</span>
                                          <span className="font-mono text-slate-600 font-semibold">{cli.tel}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()
                        )}

                        {/* Tool triggered health campaigns visualizer */}
                        {m.functionCalled === "getHealthCampaigns" && m.toolResult && m.toolResult.campaigns && (
                          <div className="mt-4 border-t border-slate-200 pt-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                              <span className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
                                Active System Health Campaigns & Reward Incentives
                              </span>
                              <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full font-bold">Programs Loaded</span>
                            </div>

                            <div className="flex flex-col gap-3 mt-1">
                              {m.toolResult.campaigns.map((camp: any, i: number) => {
                                const isJoined = joinedCampaigns.includes(camp.id);
                                return (
                                  <div key={i} className="p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 flex flex-col gap-2.5 shadow-3xs transition">
                                    <div className="flex justify-between items-start gap-3">
                                      <div>
                                        <h4 className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                                          🌟 {camp.title}
                                        </h4>
                                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{camp.description}</p>
                                      </div>
                                      {isJoined ? (
                                        <span className="px-2.5 py-1 shrink-0 text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-full font-bold flex items-center gap-1">
                                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Joined
                                        </span>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            setJoinedCampaigns(prev => [...prev, camp.id]);
                                            setMessages(chats => [
                                              ...chats,
                                              {
                                                id: "camp-alert-" + Date.now(),
                                                role: "model",
                                                text: `🎉 **Challenge Joined Successfully!** You are now enrolled in the **${camp.title}** program.\n\nTo earn your incentive: **${camp.incentive}**, make sure to perform the daily healthy practice task: *"${camp.healthyPractice}"* and keep our assistant informed of your parameters! Let's build healthy habits together!`,
                                                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                                actionType: "general_conversation"
                                              }
                                            ]);
                                          }}
                                          className="px-3.5 py-1.5 font-bold text-[10px] text-white bg-emerald-600 hover:bg-emerald-700 rounded-full cursor-pointer flex items-center gap-1 transition shadow-3xs select-none shrink-0"
                                        >
                                          Join Challenge
                                        </button>
                                      )}
                                    </div>

                                    <div className="text-[11px] bg-slate-50 p-3 rounded-lg border border-slate-101 space-y-1.5">
                                      <div>
                                        <span className="font-bold text-slate-700">Healthy Practice Task: </span>
                                        <span className="text-slate-600">{camp.healthyPractice}</span>
                                      </div>
                                      <div>
                                        <span className="font-bold text-slate-700">Incentive Reward: </span>
                                        <span className="text-emerald-700 font-bold bg-emerald-50/50 px-1.5 py-0.5 rounded border border-emerald-100/40 inline-block font-mono">🎁 {camp.incentive}</span>
                                      </div>
                                      {camp.importance && (
                                        <div className="pt-2 border-t border-slate-200/50 text-[10px] text-slate-400 font-medium">
                                          ⓘ {camp.importance}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className={`text-[10px] mt-2 block ${isUser ? 'text-slate-400' : 'text-slate-400'}`}>
                          {m.timestamp}
                        </div>
                      </div>

                      {/* User Avatar */}
                      {isUser && (
                        <div className="p-2 bg-slate-900 text-white rounded-xl h-10 w-10 flex items-center justify-center shrink-0 shadow-xs">
                          <User className="w-5 h-5" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Waiting status spinner */}
              {isProcessing && (
                <div className="flex gap-3.5 justify-start">
                  <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl h-10 w-10 flex items-center justify-center shrink-0 shadow-xs">
                    <Stethoscope className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="p-3.5 rounded-2xl max-w-[80%] bg-slate-50 border border-slate-200/80 rounded-tl-none flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                    <span className="text-xs text-slate-500 font-semibold italic">Processing tool grounding loop...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* LIVE AUDIO WAVE RECORDING INDICATOR */}
            {isListening && (
              <div className="absolute inset-x-0 bottom-18 bg-emerald-600 text-white px-5 py-3 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  <span className="text-xs font-bold tracking-wide uppercase">Voice Recording Active</span>
                </div>
                
                {/* Simulated Audio Waves visualizers */}
                <div className="flex items-center gap-0.5 h-6">
                  <div className="w-0.75 bg-white rounded animate-bounce [animation-delay:0.1s] h-4" />
                  <div className="w-0.75 bg-white rounded animate-bounce [animation-delay:0.3s] h-6" />
                  <div className="w-0.75 bg-white rounded animate-bounce [animation-delay:0s] h-3" />
                  <div className="w-0.75 bg-white rounded animate-bounce [animation-delay:0.5s] h-5" />
                  <div className="w-0.75 bg-white rounded animate-bounce [animation-delay:0.2s] h-6" />
                </div>
                
                <button
                  onClick={toggleListening}
                  className="text-[10px] uppercase tracking-wider font-bold bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-md"
                >
                  Cancel
                </button>
              </div>
            )}

            {sttError && (
              <div className="mx-4 mt-2 mb-1 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-850 shadow-3xs animate-fade-in">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-medium">{sttError}</span>
                </div>
                <button 
                  onClick={() => setSttError(null)}
                  className="font-bold text-[10px] bg-rose-100 hover:bg-rose-200 text-rose-800 px-2.5 py-1 rounded-md shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* BOTTOM INPUT CONTROLS BAR */}
            <div className="p-4 bg-slate-50 border-t border-slate-200">
              <div className="flex items-center gap-3">
                
                {/* Voice Record trigger */}
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-3 rounded-xl transition shadow-xs flex items-center justify-center shrink-0 ${
                    isListening 
                      ? "bg-red-600 text-white animate-pulse" 
                      : !sttSupported 
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                  }`}
                  title={isListening ? "Stop voice listening" : "Click to ask via Voice (STT)"}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                {/* Text prompt query input */}
                <input
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isProcessing) {
                      handleSubmitMessage();
                    }
                  }}
                  disabled={isProcessing}
                  placeholder={
                    isListening 
                      ? "Listening to voice input..." 
                      : "Type symptoms such as 'What meds do I take?' or 'Find pharmacy'..."
                  }
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600 text-sm shadow-inner disabled:opacity-60"
                />

                {/* Submit query pointer */}
                <button
                  onClick={() => handleSubmitMessage()}
                  disabled={isProcessing || !currentInput.trim()}
                  className="p-3 bg-slate-900 text-white font-bold rounded-xl transition hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>

              </div>
            </div>

          </div>

          {/* LOWER ACCREDITATION DISCLAIMER BLOCK */}
          <footer className="mt-3 flex items-center justify-center gap-2 text-slate-400 text-xs py-1">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>Encrypted Database Sandbox | Secure Workspace Proxy Authentication</span>
          </footer>

        </section>

      </main>
    </div>
  );
}
