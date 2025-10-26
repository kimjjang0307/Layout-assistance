// @google/genai START
import { GoogleGenAI, Type, Modality } from "@google/genai";
// @google/genai END
import type {
  PoseImage,
  PerspectiveData,
  ChatMessage,
  CameraOptions,
} from '../types';

// DEFINE GEMINI MODELS
const TEXT_MODEL = 'gemini-2.5-flash';
const IMAGE_EDITING_MODEL = 'gemini-2.5-flash-image';

// INITIALIZE GEMINI CLIENT
// @google/genai START
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
// @google/genai END

// TYPE DEFINITIONS
interface GenerateImageParams {
  poseImages: PoseImage[];
  globalReferenceImage: { imageDataUrl: string } | null;
  editBaseImage: { imageDataUrl: string } | null;
  prompt: string;
  negativePrompt: string;
  perspectiveData: PerspectiveData;
  outputStyle: 'genga_style' | 'clean_lineart';
  canvasDimensions: { width: number, height: number };
  sketchBoundingBox: { x: number; y: number; width: number; height: number; } | null;
  workMode: 'single' | 'multi';
  cameraOptions: CameraOptions;
  seed?: number;
  chatHistory: ChatMessage[];
  baseCanvasDataUrl?: string; // This is added internally
}

interface AnalyzeSceneParams {
    poseImages: PoseImage[];
    globalReferenceImage: { imageDataUrl: string } | null;
    editBaseImage: { imageDataUrl: string } | null;
    prompt: string;
    negativePrompt: string;
    perspectiveData: PerspectiveData;
    canvasDimensions: { width: number, height: number };
    sketchBoundingBox: { x: number; y: number; width: number; height: number } | null;
    workMode: 'single' | 'multi';
    cameraOptions: CameraOptions;
}

interface EditImageWithChatParams {
  baseImageUrl: string;
  referenceImageUrl?: string | null;
  sketchImageUrl?: string | null;
  chatHistory: ChatMessage[];
  newMessage: string;
  cameraOptions: CameraOptions;
}

// HELPER FUNCTIONS
const dataUrlToGenerativePart = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
  if (!match) {
    throw new Error('Invalid data URL format');
  }
  const [, mimeType, data] = match;
  return {
    inlineData: {
      mimeType,
      data,
    },
  };
};

const getImageDimensions = (dataUrl: string): Promise<{ width: number, height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = dataUrl;
  });
};

const createWhiteCanvasDataUrl = (width: number, height: number): string => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    return canvas.toDataURL('image/png');
};

const buildInterlinkedPromptParts = async (params: GenerateImageParams | AnalyzeSceneParams): Promise<any[]> => {
    const parts: any[] = [];
    let textPrompt = ``;

    if (params.prompt) {
        textPrompt += `**Positive Prompt:** ${params.prompt}\n`;
    }
    if ('negativePrompt' in params && params.negativePrompt) {
        textPrompt += `**Negative Prompt:** ${params.negativePrompt}\n`;
    }

    if ('chatHistory' in params && params.chatHistory.length > 0) {
        textPrompt += `\n**Conversation History:**\n`;
        params.chatHistory.forEach(msg => {
            textPrompt += `*   **${msg.role}:** ${msg.parts.map(p => p.text).join(' ')}\n`;
        });
    }

    if (params.perspectiveData.vanishingPoints.length > 0) {
        textPrompt += `\n**Perspective Data:**\n${JSON.stringify(params.perspectiveData, null, 2)}\n`;
    }
    
    const { cameraOptions } = params;
    const cameraSettings: string[] = [];
    if (cameraOptions.shotType && cameraOptions.shotType !== 'none') cameraSettings.push(`Shot Type: ${cameraOptions.shotType}`);
    if (cameraOptions.angleType && cameraOptions.angleType !== 'none') cameraSettings.push(`Angle Type: ${cameraOptions.angleType}`);
    if (cameraOptions.lens && cameraOptions.lens !== 'none') cameraSettings.push(`Lens: ${cameraOptions.lens}`);
    if (cameraOptions.verticalAngle !== 0) cameraSettings.push(`Vertical Angle (Tilt): ${-cameraOptions.verticalAngle}°`);
    if (cameraOptions.horizontalAngle !== 0) cameraSettings.push(`Horizontal Angle (Pan): ${-cameraOptions.horizontalAngle}°`);
    if (cameraOptions.rollAngle !== 0) cameraSettings.push(`Roll Angle: ${cameraOptions.rollAngle}°`);
    if (cameraOptions.zoomLevel !== 1.0) cameraSettings.push(`Zoom: ${cameraOptions.zoomLevel.toFixed(2)}x`);
    if (cameraOptions.dolly !== 0) cameraSettings.push(`Dolly: ${cameraOptions.dolly}`);
    if (cameraOptions.horizontalShift !== 0) cameraSettings.push(`Truck: ${cameraOptions.horizontalShift}`);
    if (cameraOptions.verticalShift !== 0) cameraSettings.push(`Pedestal: ${-cameraOptions.verticalShift}`);
    
    if (cameraSettings.length > 0) {
        textPrompt += `\n**Camera Settings:**\n${cameraSettings.join(', ')}\n`;
    }

    textPrompt += `\n**Canvas Dimensions:** ${params.canvasDimensions.width}x${params.canvasDimensions.height}\n`;
    
    if (params.sketchBoundingBox) {
        textPrompt += `\n**Sketch Bounding Box:**\n${JSON.stringify(params.sketchBoundingBox, null, 2)}\n`;
    }

    parts.push({ text: textPrompt });
    
    // The first image passed to the model acts as the base image to be edited.
    // The calling function (`generateCharacterImage`) is responsible for ensuring
    // this is either the user's intended base image for editing, or a blank canvas for generation.
    if ('editBaseImage' in params && params.editBaseImage) {
        parts.push({ text: "BASE IMAGE FOR EDITING:" });
        parts.push(dataUrlToGenerativePart(params.editBaseImage.imageDataUrl));
    }

    for (const pose of params.poseImages) {
        if (pose.imageDataUrl) {
            parts.push({ text: `LOW-PRIORITY SKETCH HINT for "${pose.name}": This is a suggestion only. The CONTI image OVERRULES this sketch.` });
            parts.push(dataUrlToGenerativePart(pose.imageDataUrl));
        }
        if (pose.setteiImages) {
            for (const settei of pose.setteiImages) {
                parts.push({ text: `MANDATORY STYLE REFERENCE (SETTEI) for "${pose.name}": You MUST use this art style. You MUST IGNORE this pose.` });
                parts.push(dataUrlToGenerativePart(settei.imageUrl));
                if (settei.maskUrl) {
                    parts.push({ text: `Settei RGB MASK for Layer "${pose.name}" (R=front, G=side, B=back):` });
                    parts.push(dataUrlToGenerativePart(settei.maskUrl));
                }
            }
        }
    }
    
    if (params.globalReferenceImage) {
        parts.push({ text: "ABSOLUTE POSE & COMPOSITION SOURCE (CONTI): TRACE THIS POSE. IGNORE THIS STYLE. THIS IS THE MOST IMPORTANT IMAGE." });
        parts.push(dataUrlToGenerativePart(params.globalReferenceImage.imageDataUrl));
    }

    return parts;
};

const generateSystemInstruction = (
  outputStyle: 'genga_style' | 'clean_lineart',
  workMode: 'single' | 'multi',
  hasGlobalReference: boolean,
  isEditingTask: boolean
): string => {
  const taskTypeInstruction = isEditingTask
    ? 'This is an EDITING task. A base image is provided. Modify it according to the other inputs. Do not create a new image from scratch.'
    : 'This is a GENERATION task. A blank canvas is provided as the base image. Create a new image on this canvas by combining the other inputs.';

 return `
# ROLE: Technical Illustrator AI

You are a technical operator executing a precise image synthesis task. Your output must be a clean, black-and-white line art image on a transparent background.

${taskTypeInstruction}

---
## CORE DIRECTIVE: RULE-BASED IMAGE SYNTHESIS
---
You will be given multiple input images with specific labels. Combine them according to the following non-negotiable rules.

### RULE 1: THE CONTI IS ABSOLUTE LAW FOR POSE AND COMPOSITION
- The image labeled **"ABSOLUTE POSE & COMPOSITION SOURCE (CONTI)"** dictates the final output's pose, character placement, and camera framing.
- **ACTION:** Your primary, non-negotiable directive is to TRACE the pose and composition from the CONTI image with 100% accuracy. Do NOT deviate. Do NOT interpret. Do NOT get creative.
- **CRITICAL:** The art style of the CONTI is IRRELEVANT. You MUST IGNORE IT COMPLETELY.
- **FAILURE CONDITION:** FAILURE TO REPLICATE THE CONTI POSE IS A COMPLETE FAILURE OF YOUR TASK.

### RULE 2: THE SETTEI IS LAW FOR STYLE AND CHARACTER DESIGN
- The image labeled **"MANDATORY STYLE REFERENCE (SETTEI)"** dictates the art style, line quality, and character details.
- **ACTION:** You MUST apply the character design and line style from the SETTEI onto the pose you traced from the CONTI.
- **CRITICAL:** The pose in the SETTEI is for reference ONLY. You MUST IGNORE IT COMPLETELY.

### RULE 3: THE SKETCH IS A SUBORDINATE HINT
- The image labeled **"LOW-PRIORITY SKETCH HINT"** is only a suggestion.
- **CRITICAL:** If the SKETCH contradicts the CONTI in any way, the **CONTI ALWAYS WINS.** You MUST ignore the conflicting information from the SKETCH.

### RULE 4: OUTPUT FORMAT IS STRICT
- **ACTION:** The final image must be black line art on a transparent background.
- **CRITICAL:** No color. No grayscale. No shading. No backgrounds.

### RULE 5: GAZE DIRECTION (EYE-LINE)
- **DEFAULT BEHAVIOR:** Unless explicitly contradicted by the user's text prompt, all characters' gaze MUST align naturally with the direction their head is facing, as defined by the CONTI.
- **PROMPT OVERRIDE:** If the text prompt provides specific instructions for the character's gaze (e.g., "looking at the camera"), those instructions take absolute precedence.

---
## EXECUTION SUMMARY
---
1.  **TRACE** the pose from the **CONTI**.
2.  **APPLY** the style from the **SETTEI** to that trace.
3.  **ADHERE** to the gaze direction rules.
4.  **OUTPUT** clean, black-and-white line art on a transparent background.

Precision is your only goal.
`;
};


export const translateToEnglish = async (text: string): Promise<string> => {
    if (!text) {
        return "";
    }
    try {
        // @google/genai START
        const response = await ai.models.generateContent({
            model: TEXT_MODEL,
            contents: `Translate the following Korean text to English. Return only the English translation and nothing else:\n\n${text}`,
        });
        // @google/genai END
        return response.text.trim();
    } catch (error) {
        console.error("Translation to English failed, using original text:", error);
        return text; // Fallback to original text on error
    }
};

export const generateCharacterImage = async (params: GenerateImageParams): Promise<string> => {
    const hasGlobalReference = !!params.globalReferenceImage;
    // An editing task is ONLY when an editBaseImage is provided AND there is no conti.
    const isEditingTask = !!params.editBaseImage && !hasGlobalReference;

    const systemInstruction = generateSystemInstruction(params.outputStyle, params.workMode, hasGlobalReference, isEditingTask);
    
    const finalParams = { ...params };

    if (!isEditingTask) {
        // This is a generation task. The image editing model requires a base image to work on,
        // so we provide a blank white canvas.
        let targetWidth = params.canvasDimensions.width;
        let targetHeight = params.canvasDimensions.height;
        
        if (hasGlobalReference) {
            try {
                // Match the blank canvas dimensions to the conti for best results.
                const dims = await getImageDimensions(params.globalReferenceImage!.imageDataUrl);
                targetWidth = dims.width;
                targetHeight = dims.height;
            } catch (e) {
                console.error("Could not get conti dimensions, using canvas dimensions.", e);
            }
        }
        
        finalParams.editBaseImage = { imageDataUrl: createWhiteCanvasDataUrl(targetWidth, targetHeight) };
    }
    
    const parts = await buildInterlinkedPromptParts(finalParams);
    
    // @google/genai START
    const response = await ai.models.generateContent({
        model: IMAGE_EDITING_MODEL,
        contents: { parts },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
            seed: params.seed,
            systemInstruction: { parts: [{ text: systemInstruction }] },
        },
    });
    // @google/genai END
    
    const imagePart = response.candidates?.[0]?.content.parts.find(p => p.inlineData);
    if (imagePart?.inlineData) {
        return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    }

    const textPart = response.text;
    console.error("Image generation failed. Text response:", textPart);
    throw new Error(`Image generation failed. The model responded with: ${textPart || 'No text response.'}`);
};

export const analyzeScene = async (params: AnalyzeSceneParams): Promise<{ analysisReport: string }> => {
    const parts = await buildInterlinkedPromptParts(params);

    parts.unshift({
        text: `
SYSTEM PROMPT: You are a world-class animation director and layout artist.
Your task is to analyze the provided scene information (storyboard, sketches, etc.) and provide one output:
1.  **Analysis Report**: A concise, professional report in **KOREAN** that a human director can read. It should describe the scene's composition, character poses, and implied emotional tone based on the inputs. Use markdown for formatting.

Analyze the following scene components:
`
    });
    
    // @google/genai START
    const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: { parts },
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    analysisReport: { type: Type.STRING },
                },
                required: ['analysisReport'],
            },
        },
    });
    // @google/genai END

    try {
        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        if (result.analysisReport) {
            return result;
        } else {
            throw new Error("Invalid JSON structure in analysis response.");
        }
    } catch (e) {
        console.error("Failed to parse analysis response JSON:", e);
        console.error("Raw response text:", response.text);
        throw new Error("Failed to get a valid analysis from the AI. The response was not in the expected format.");
    }
};

export const simpleChat = async (history: ChatMessage[]): Promise<string> => {
    const contents = history.map(msg => ({
        role: msg.role,
        parts: msg.parts.map(p => ({ text: p.text })),
    }));
    
    // @google/genai START
    const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: contents,
        config: {
            systemInstruction: {
                parts: [{ text: "You are a helpful assistant for an animation director. Respond concisely in Korean." }],
            },
        },
    });
    // @google/genai END
    
    return response.text;
};

// FIX: This function was incomplete, causing a build error. It has been implemented to handle image editing via chat.
export const editImageWithChat = async (params: EditImageWithChatParams): Promise<{ newImageUrl: string, textResponse: string }> => {
    const systemInstruction = `You are an AI Inpainting and Outpainting Specialist. Your function is equivalent to a 'smart patch' or 'healing brush' tool in an advanced image editor. You will receive a base image, and your task is to modify it based on text instructions, potentially using a reference image for style and a sketch for composition guidance. Respond with the edited image and a brief, professional confirmation message in Korean.`;

    const parts: any[] = [];
    
    let textPrompt = `**New Instruction:** ${params.newMessage}\n\n`;

    if (params.chatHistory.length > 0) {
        textPrompt += `**Conversation History (for context):**\n`;
        params.chatHistory.forEach(msg => {
            textPrompt += `*   **${msg.role}:** ${msg.parts.map(p => p.text).join(' ')}\n`;
        });
    }

    const { cameraOptions } = params;
    const cameraSettings: string[] = [];
    if (cameraOptions.shotType && cameraOptions.shotType !== 'none') cameraSettings.push(`Shot Type: ${cameraOptions.shotType}`);
    if (cameraOptions.angleType && cameraOptions.angleType !== 'none') cameraSettings.push(`Angle Type: ${cameraOptions.angleType}`);
    if (cameraOptions.lens && cameraOptions.lens !== 'none') cameraSettings.push(`Lens: ${cameraOptions.lens}`);
    if (cameraOptions.verticalAngle !== 0) cameraSettings.push(`Vertical Angle (Tilt): ${-cameraOptions.verticalAngle}°`);
    if (cameraOptions.horizontalAngle !== 0) cameraSettings.push(`Horizontal Angle (Pan): ${-cameraOptions.horizontalAngle}°`);
    if (cameraOptions.rollAngle !== 0) cameraSettings.push(`Roll Angle: ${cameraOptions.rollAngle}°`);
    
    if (cameraSettings.length > 0) {
        textPrompt += `\n**Camera Settings:**\n${cameraSettings.join(', ')}\n`;
    }

    parts.push({ text: textPrompt });

    parts.push({ text: "BASE IMAGE FOR EDITING:" });
    parts.push(dataUrlToGenerativePart(params.baseImageUrl));
    
    if (params.referenceImageUrl) {
        parts.push({ text: "REFERENCE IMAGE FOR STYLE:" });
        parts.push(dataUrlToGenerativePart(params.referenceImageUrl));
    }
    
    if (params.sketchImageUrl) {
        parts.push({ text: "SKETCH HINT FOR COMPOSITION:" });
        parts.push(dataUrlToGenerativePart(params.sketchImageUrl));
    }

    // @google/genai START
    const response = await ai.models.generateContent({
        model: IMAGE_EDITING_MODEL,
        contents: { parts },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
            systemInstruction: { parts: [{ text: systemInstruction }] },
        },
    });
    // @google/genai END

    const imagePart = response.candidates?.[0]?.content.parts.find(p => p.inlineData);
    const textPart = response.text;
    
    if (imagePart?.inlineData) {
        return {
            newImageUrl: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
            textResponse: textPart || "작업을 완료했습니다."
        };
    }

    throw new Error(`Image editing failed. The model responded with: ${textPart || 'No text response.'}`);
};