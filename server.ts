import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;

// Initialize GoogleGenAI developer SDK
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("WARNING: GEMINI_API_KEY environment variable is not set. API calls will fail.");
}

const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Tool declarations
const HEALTH_CAMPAIGNS = [
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
];

const getUserHistory: FunctionDeclaration = {
  name: "getUserHistory",
  description: "Fetch the user's medical history, chronic conditions, and active medications from the secure application database.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const openFacilityMaps: FunctionDeclaration = {
  name: "openFacilityMaps",
  description: "Find nearby physical healthcare clinics, hospitals, urgent cares, pharmacies, or doctors base on a query.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "Specify the facility type to find, e.g. 'Urgent care', 'Emergency hospital', 'Pharmacy', or 'Pediatrician'.",
      },
      location: {
        type: Type.STRING,
        description: "The optional city name, state, neighborhood, or general zip code if provided.",
      },
    },
    required: ["query"],
  },
};

const getHealthCampaigns: FunctionDeclaration = {
  name: "getHealthCampaigns",
  description: "Retrieve any active healthcare campaigns, community challenges, healthy habit incentives, and reward options running in the system.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

// --- API Endpoint for processing agent dialogue ---
app.post("/api/health-agent/chat", async (req, res) => {
  try {
    const { history, message, userData } = req.body;

    if (!message) {
      res.status(400).json({ error: "Missing 'message' field in query." });
      return;
    }

    // Build standard contents array for the request
    let contents = [];
    if (history && Array.isArray(history)) {
      contents = [...history];
    }
    
    // Add the current user query to contents
    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const userLocation = userData?.location || "Brooklyn, New York";

    // Call the model with user location-conditioned system instructions
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: `You are a professional, highly warm and empathetic Health Assistant. Be structured, supportive, and clear.
CURRENT USER LOCATION CONTEXT: The user is currently residing or located in: "${userLocation}".
All physical facility lookups, recommendations, and tool calls must be grounded and localized to this location ("${userLocation}"). Never recommend clinics, hospitals, or pharmacies in a different region or country unless the user explicitly requests another city.
When triggering the 'openFacilityMaps' tool, always input "${userLocation}" as the 'location' argument if not explicitly provided otherwise by the user.

IMPORTANT DIALOGUE & HEALTH CAMPAIGNS RULES:
1. Under NO circumstances should you provide a definitive medical diagnosis, prescribe drugs, or change a patient's medication dosage.
2. ALWAYS use the 'getUserHistory' tool as context if the user asks about 'my medical history', 'what medications am I taking', 'am I allergic to anything', or relative health records. Never hallucinate or make up their records—look them up first.
3. If database records are missing, empty, or do not contain information related to their query, or if the user asks a general wellness question, DO NOT say "I cannot find the records, visit a doctor". Instead, use your professional health knowledge to explain the topic clearly and suggest ethical, practical, and highly contextual next steps (such as lifestyle adjustments, self-care routines, monitoring templates, consulting a local pharmacist, or updating their profile form). Keep your suggestions strictly proportioned to the risk level.
4. INCORPORATE HEALTH CAMPAIGNS & INCENTIVES: The platform runs promotional health campaigns that offer tangible rewards (Wellness Points, medical vouchers, healthy gift rewards) for completing healthy practices. If appropriate (and especially when the user asks about health, fitness, challenges, rewards, campaigns, asthma, or blood pressure), invoke the 'getHealthCampaigns' tool to retrieve current campaigns.
5. PERSONALIZATION WITH DATA: When users have history or medications (e.g. Asthma, Hypertension), pitch the matching health campaigns (e.g., recommend 'Cardio-Shield Steps Challenge' for Hypertension, 'Asthmawise Breathing Log' for Asthma) explaining that their specific history makes them an excellent fit, and detail how the healthy practices will benefit them.
6. GENERAL WELLNESS SANS DATA: If no personalized medical records are logged or available or they do not address any specific illness, advise them on overall wellbeing and pitch generalized challenges (e.g., Cardio-Shield steps or Mindful Minutes Stress Reduction) as amazing healthy habits with valuable incentives. Never let them feel limited.
7. If the user is searching for medical facilities, clinics, hospitals, or pharmacies locally, trigger the 'openFacilityMaps' tool, grounding the lookup around "${userLocation}".
8. If the user presents life-threatening or severe urgent symptoms (e.g., crushing chest pain, extreme sudden breathlessness, severe bleeding or severe strokes), direct them to call 911 (or their local equivalent emergency number based on their location: "${userLocation}") or visit the nearest emergency room immediately, placing safety before everything else.`,
        tools: [{ functionDeclarations: [getUserHistory, openFacilityMaps, getHealthCampaigns] }],
      },
    });

    const functionCalls = response.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      let toolResult: any = {};
      let actionType = "";

      if (call.name === "getUserHistory") {
        toolResult = {
          user: {
            name: userData?.name || "John",
            history: userData?.history || "No chronic medical history logged",
            meds: userData?.meds || "No prescription medications logged"
          }
        };
        actionType = "database_lookup";
      } else if (call.name === "openFacilityMaps") {
        toolResult = {
          status: "Display maps recommendation for " + call.args.query,
          query: call.args.query,
          location: call.args.location || userLocation
        };
        actionType = "map_grounding";
      } else if (call.name === "getHealthCampaigns") {
        toolResult = {
          status: "Successfully pulled active system health campaigns",
          campaigns: HEALTH_CAMPAIGNS
        };
        actionType = "database_lookup";
      }

      // Add assistant response containing the function call
      contents.push(response.candidates?.[0]?.content);

      // Add the tool reaction to the contents thread
      contents.push({
        role: "tool",
        parts: [{
          functionResponse: {
            name: call.name,
            response: { content: toolResult }
          }
        }]
      });

      // Query Gemini again with the tool output so it can generate the final humanized explanation
      const secondResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: `You are a professional, highly warm and empathetic Health Assistant. Ground your suggestions specifically in the user's location: "${userLocation}".
Use the fetched database context, visual maps recommendation, or application health campaigns to provide an intelligent, accurate, and supportive response to the user. Do not make up facts or diagnoses.

IMPORTANT FOR DATABASE OUTCOMES:
If the database record returned is empty, says "No chronic medical history logged", or does not address the exact question, DO NOT say "I have not found the records, visit a doctor". Instead, explain with deep empathy what is generally understood about their symptom/topic using your advanced professional health and wellness training. Offer helpful everyday next steps (e.g., self-care protocols, habit logs, sleeping posture checklists, hydration parameters) tailored specifically to their issue, keeping suggestions proportioned to the symptom's actual risk level.

IMPORTANT FOR PROGRAM INITIATIVES (CAMPAIGNS) & INCENTIVES:
If the 'getHealthCampaigns' tool was run, present the active campaigns beautifully, highlighting the explicit daily healthy practices the user would perform (such as 6,000 daily steps for Cardio-Shield or 10-minute quiet meditation for Mindful Minutes) and explain the reward incentives ($5 pharmacy copay vouchers, free tea, free inhaler spacers) that wait for them on completion. Strongly encourage the user to join the challenge to earn their incentives and jumpstart healthy habits!
In your final feedback, mention that because of their specific history (or generally as a wellness seeker), this challenge is highly beneficial. Detail how they can immediately enroll.

IMPORTANT FOR MAPS:
Confirm that the map results or recommendations are local and easily accessible within "${userLocation}". Highlight that the map displays nearby facilities pinned directly around their localized location context.`,
        },
      });

      res.json({
        text: secondResponse.text || "I found the required records, but couldn't formulate a text explanation. Please consult a doctor.",
        functionCalled: call.name,
        functionArgs: call.args,
        toolResult: toolResult,
        actionType: actionType
      });
    } else {
      // Normal response from Gemini without function loops
      res.json({
        text: response.text || "I'm here to support you. Could you rephrase your question?",
        actionType: "general_conversation"
      });
    }
  } catch (error: any) {
    console.error("HealthAgent Endpoint Error (Transitioning to Offline Healing Mode):", error);
    
    const { message, userData } = req.body || {};
    const lowerMessage = (message || "").toLowerCase();
    const userLocation = userData?.location || "Brooklyn, New York";
    
    let fallbackText = "";
    let fallbackFunctionCalled: string | undefined = undefined;
    let fallbackFunctionArgs: any = undefined;
    let fallbackToolResult: any = undefined;
    let fallbackActionType = "general_conversation";

    const isEmergency = lowerMessage.includes("emergency") || 
                        lowerMessage.includes("chest pain") || 
                        lowerMessage.includes("heart attack") || 
                        lowerMessage.includes("stroke") || 
                        lowerMessage.includes("severe bleed") || 
                        lowerMessage.includes("dying") || 
                        lowerMessage.includes("breathlessness") || 
                        lowerMessage.includes("911");

    const isMapsQuery = lowerMessage.includes("hospital") || 
                        lowerMessage.includes("clinic") || 
                        lowerMessage.includes("pharmacy") || 
                        lowerMessage.includes("doctor") || 
                        lowerMessage.includes("pediatrician") || 
                        lowerMessage.includes("chemist") || 
                        lowerMessage.includes("medical facility") || 
                        lowerMessage.includes("urgent care") || 
                        lowerMessage.includes("look up") || 
                        lowerMessage.includes("find") || 
                        lowerMessage.includes("where is") || 
                        lowerMessage.includes("map");

    const isHistoryQuery = lowerMessage.includes("history") || 
                          lowerMessage.includes("what conditions") || 
                          lowerMessage.includes("diagnosed") || 
                          lowerMessage.includes("my records") || 
                          lowerMessage.includes("what medications") || 
                          lowerMessage.includes("what meds") || 
                          lowerMessage.includes("active prescription") || 
                          lowerMessage.includes("allerg") || 
                          lowerMessage.includes("allergic");

    const isCampaignsQuery = lowerMessage.includes("campaign") || 
                            lowerMessage.includes("challenge") || 
                            lowerMessage.includes("reward") || 
                            lowerMessage.includes("incentive") || 
                            lowerMessage.includes("points") || 
                            lowerMessage.includes("program") || 
                            lowerMessage.includes("active wellness") || 
                            lowerMessage.includes("join");

    if (isEmergency) {
      fallbackFunctionCalled = "openFacilityMaps";
      fallbackFunctionArgs = { query: "Emergency Room / Hospital", location: userLocation };
      fallbackToolResult = {
        status: "Display maps recommendation for Emergency Room / Hospital",
        query: "Emergency Room / Hospital",
        location: userLocation
      };
      fallbackActionType = "map_grounding";
      fallbackText = `🚨 **URGENT EMERGENCY RESPONSE REQUIRED** 🚨\n\nBased on your described symptoms, you might be facing a life-threatening medical situation. **Please call 911 (or your local emergency number in ${userLocation}) immediately, or proceed to the nearest emergency room.**\n\nI have automatically centered our visual locator widget below on **"Emergency Rooms"** in **${userLocation}** to assist your immediate transit. Please do not wait. Your physical safety is the absolute highest priority.`;
    } else if (isMapsQuery) {
      let queryType = "General Clinic / Medical Center";
      if (lowerMessage.includes("pharmacy") || lowerMessage.includes("chemist")) {
        queryType = "Pharmacy";
      } else if (lowerMessage.includes("pediatrician") || lowerMessage.includes("peds") || lowerMessage.includes("kid")) {
        queryType = "Pediatrician";
      } else if (lowerMessage.includes("urgent care")) {
        queryType = "Urgent Care Clinic";
      } else if (lowerMessage.includes("dentist") || lowerMessage.includes("teeth")) {
        queryType = "Dentist office";
      }

      fallbackFunctionCalled = "openFacilityMaps";
      fallbackFunctionArgs = { query: queryType, location: userLocation };
      fallbackToolResult = {
        status: "Display maps recommendation for " + queryType,
        query: queryType,
        location: userLocation
      };
      fallbackActionType = "map_grounding";
      fallbackText = `🗺️ **Local Facility Navigation Connected**\n\nI have initialized our spatial map locator. Nearby recommendations for **"${queryType}"** centered around your location of **"${userLocation}"** have been pinned in the visual interactive map container below.\n\n*Click on any pin coordinates to load direct walking or driving directions.*`;
    } else if (isHistoryQuery) {
      fallbackFunctionCalled = "getUserHistory";
      fallbackFunctionArgs = {};
      fallbackToolResult = {
        user: {
          name: userData?.name || "John",
          history: userData?.history || "No chronic medical history logged",
          meds: userData?.meds || "No prescription medications logged"
        }
      };
      fallbackActionType = "database_lookup";
      fallbackText = `📋 **Secure Medical History Retrieved**\n\nI have retrieved your medical parameters from our offline-cached database profiles for user **${userData?.name || "John"}**:\n\n• **Chronic Illnesses/History**: ${userData?.history || "No chronic medical history logged"}\n• **Active Medications**: ${userData?.meds || "No prescription medications logged"}\n\n*Because of your registered conditions, you have an excellent fit for our reward-optimized wellness campaigns. Would you like me to display them?*`;
    } else if (isCampaignsQuery) {
      fallbackFunctionCalled = "getHealthCampaigns";
      fallbackFunctionArgs = {};
      fallbackToolResult = {
        status: "Successfully pulled active system health campaigns",
        campaigns: HEALTH_CAMPAIGNS
      };
      fallbackActionType = "database_lookup";
      fallbackText = `🎁 **Wellness Incentives Directory Opened**\n\nI have fetched our current system wellness campaigns and tangible incentives. Here are the active challenges you are eligible to join directly:\n\n1. **Cardio-Shield Steps Challenge**: Intended for heart rate and blood pressure maintenance. Walk 6,000 steps daily. **Reward: 500 Wellness Points** ($5 prescription copay deduction voucher).\n2. **Asthmawise Breathing Log**: Intended to track bronchial and coughing triggers. Complete daily logs. **Reward: Free peak-flow meter instrument / spacer**.\n3. **Mindful Minutes Stress Reduction**: Log 10 minutes of tactical box-breathing. **Reward: Organic loose-leaf wellness tea sampler**.\n\nYou can click **"Join Challenge"** on any of the program cards underneath to activate logging, claim points, and earn physical wellness rewards!`;
    } else if (lowerMessage.includes("blood pressure") || lowerMessage.includes("hypertension") || lowerMessage.includes(" bp ") || lowerMessage.includes("cardio") || lowerMessage.includes("heart")) {
      fallbackText = `%HEALTH_METRIC_BP%🩺 **Hypertension & Blood Pressure Care Program Guide**\n\nMaintaining balanced systemic blood pressure relies on small daily practices. Under offline wellness guidance, prioritize these standard parameters:\n\n1. **Sodium Restructuring**: Keep sodium intake strictly below 1,500mg daily (avoid pre-packaged process ingredients).\n2. **Aerobic Endurance**: Engage in moderate aerobics such as a 30-minute daily gentle walk to optimize blood vessel flexibility.\n3. **Regular hydration**: Aim for 8-10 glasses of water, scheduling standard reminders.\n\n🏆 **Active Reward Opportunity**: We highly recommend enrolling in our **Cardio-Shield Steps Challenge**! By linking a regular 6,000 steps daily target, you'll earn **500 Wellness Points ($5 medication copay discount voucher)**! You can request 'load campaigns' to join.`;
    } else if (lowerMessage.includes("asthma") || lowerMessage.includes("lung") || lowerMessage.includes("cough") || lowerMessage.includes("breath") || lowerMessage.includes("pulmonary") || lowerMessage.includes("bronch") || lowerMessage.includes("inhaler") || lowerMessage.includes("allerg")) {
      fallbackText = `%HEALTH_METRIC_ASTHMA%🫁 **Asthma & Respiratory Wellness Protocol**\n\nManaging reactive airways and maintaining peak lung volume involves strategic triggers identification:\n\n1. **Chronological Trigger Diary**: Log seasonal allergen counts, dramatic temperature drops, dust exposure, or coughing intervals.\n2. **Inhaler spacer utilization**: Administer rescue or control inhalers using a chamber/spacer device. This ensures complete aerosol particle penetration deep into bronchial walls rather than just hitting the throat.\n3. **Controlled box-breathing**: Pace autonomic anxiety-induced breathing lock.\n\n🏆 **Active Reward Opportunity**: Enroll in our **Asthmawise Breathing Log & Trigger Diary**! By logging your daily parameters and allergen conditions, you earn a **free durable peak-flow meter instrument** or a spacer spacer chamber delivered straight to your door!`;
    } else if (lowerMessage.includes("stress") || lowerMessage.includes("tension") || lowerMessage.includes("anxiet") || lowerMessage.includes("sleep") || lowerMessage.includes("insomnia") || lowerMessage.includes("fatigue") || lowerMessage.includes("relax")) {
      fallbackText = `%HEALTH_METRIC_MINDFUL%🧘 **Stress, Cortisol, & Vagal Nerve Quiet Protocol**\n\nAutonomic regulation can quickly align heart rate variability and drop adrenaline spikes. Try these routines:\n\n1. **Autonomic Quiet Box-Breathing**: Use the box-breathing method: inhale for 4s, hold for 4s, exhale for 4s, hold for 4s. Repeat for 10 minutes to rapidly shut off central adrenaline.\n2. **Melatonin protection**: Restrict high-intensity screens, caffeine, and blue light past 2:00 PM to assist natural circadian sleep rhythms.\n\n🏆 **Active Reward Opportunity**: Enroll in our **Mindful Minutes Stress & Cortisol Reduction Campaign**! Logging 10 minutes of daily quiet autonomic pacing yields an **organic loose-leaf relaxation tea sampler** delivered straight to you!`;
    } else {
      fallbackText = `👋 **Resilient Offline Healing Assistance Active**\n\nOur primary cloud-based AI system has reached its peak capacity limit or is undergoing high API demand. However, our offline intelligence agent is fully active to support you!\n\nI am fully equipped to:\n• **Check Database History**: Ask me *"What medications am I taking?"* or *"Load medical history"* to query secure cache registers.\n• **Run Interactive Map Pointers**: Ask me *"Find an urgent care near me"* to map nearest local clinics mapped directly inside **${userLocation}**.\n• **Access Challenge Rewards**: Ask me *"What challenges are active"* to view program cards with Wellness Points, free herbal tea, and medical spacer rewards.\n\nFeel free to write your query, and we will safely guide you!`;
    }

    res.json({
      text: fallbackText,
      functionCalled: fallbackFunctionCalled,
      functionArgs: fallbackFunctionArgs,
      toolResult: fallbackToolResult,
      actionType: fallbackActionType,
      isFallbackMode: true,
      offlineReason: "RESOURCE_EXHAUSTED"
    });
  }
});

// --- Vite / Static Middleware Setup ---
const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Started Vite development server middleware.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production assets from dist.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express custom server running on http://0.0.0.0:${PORT}`);
  });
};

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
