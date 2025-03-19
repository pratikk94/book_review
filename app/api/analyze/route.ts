import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFileSync } from "fs";
import { join } from "path";
import { default as pdfParse } from "pdf-parse";
import mammoth from "mammoth";
import OpenAI from "openai";
import { parse } from "json2csv";

// Make sure OpenAI API key is set
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is missing. Please add it to your environment variables.");
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Create the public directory if it doesn't exist
const publicDir = join(process.cwd(), 'public');
try {
  mkdir(publicDir, { recursive: true }, (err) => {
    if (err) console.error('Error creating public directory:', err);
  });
} catch (error) {
  console.error('Error initializing directory:', error);
}

// In-memory storage for job status (note: this won't persist between Vercel serverless function invocations)
const jobStatus = new Map();

// Simple storage for last result (for Vercel serverless environment)
// We'll store the last result and its timestamp for the last 10 requests
const lastResults = new Map();
const MAX_RESULTS = 10;

// Add a simple GET handler for testing or retrieving results
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get('jobId');
  const finalResult = url.searchParams.get('finalResult');
  
  // If finalResult is specified, return most recent result (for Vercel serverless compatibility)
  if (finalResult === 'true' && jobId) {
    if (lastResults.has(jobId)) {
      return NextResponse.json(lastResults.get(jobId));
    }
    
    // If job ID doesn't exist in results, return a processing status
    return NextResponse.json({ 
      processing: true,
      message: "Your document is still being analyzed. Please try again in a minute."
    });
  }
  
  // If jobId is provided, return job status (this will only work locally, not on Vercel)
  if (jobId) {
    if (!jobStatus.has(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }
    return NextResponse.json(jobStatus.get(jobId));
  }
  
  // Otherwise return API info
  return NextResponse.json({ 
    message: "Analyze API endpoint is working. Send a POST request with a PDF or DOCX file to analyze.",
    note: "For large files, use the two-step process: upload file to get jobId, then check status with GET /api/analyze?jobId=your_job_id"
  });
}

// Add type definitions
interface ChunkStatus {
    chunk: number;
    status: 'processing' | 'completed' | 'error';
    message: string;
}

interface AnalysisItem {
    Parameter: string;
    Score: number;
    Justification: string;
}

// Add helper functions
function splitTextIntoChunks(text: string): string[] {
    // Increase chunk size to process more content
    const CHUNK_SIZE = 12000; 
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
        chunks.push(text.slice(i, i + CHUNK_SIZE));
    }
    return chunks;
}

function generateCSV(analysis: AnalysisItem[]): string {
    const headers = ['Parameter', 'Score', 'Justification'];
    const rows = analysis.map(item => [
        item.Parameter,
        item.Score.toString(),
        `"${item.Justification.replace(/"/g, '""')}"`
    ]);
    
    return [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');
}

// Store the result for later retrieval
function storeResult(jobId: string, result: any) {
    // Store the result with a timestamp
    lastResults.set(jobId, {
        ...result,
        timestamp: Date.now()
    });
    
    // If we have too many results, remove the oldest one
    if (lastResults.size > MAX_RESULTS) {
        let oldestKey = null;
        let oldestTime = Date.now();
        
        // Convert Map entries to array to fix TypeScript iteration error
        Array.from(lastResults.entries()).forEach(([key, value]) => {
            if (value.timestamp < oldestTime) {
                oldestTime = value.timestamp;
                oldestKey = key;
            }
        });
        
        if (oldestKey) {
            lastResults.delete(oldestKey);
        }
    }
}

// Analyze text chunks and update job status
async function processFileAsync(jobId: string, text: string, fileName: string) {
    try {
        // Split text into chunks with smaller size for faster processing
        const chunks = splitTextIntoChunks(text);
        let combinedAnalysis: AnalysisItem[] = [];
        let combinedSummary = "";
        let combinedPrologue = "";
        let combinedCriticism = "";
        
        // Process only a subset of chunks if the document is very large
        const MAX_CHUNKS = 3; // Reduced from 5 to 3 to ensure faster processing
        const chunksToProcess = chunks.length > MAX_CHUNKS 
            ? [chunks[0], chunks[Math.floor(chunks.length/2)], chunks[chunks.length-1]]
            : chunks;
        
        // Update job status with progress
        jobStatus.set(jobId, {
            ...jobStatus.get(jobId),
            status: 'processing',
            progress: 20,
            chunksTotal: chunks.length,
            chunksToProcess: chunksToProcess.length,
            message: `Analyzing document (processing ${chunksToProcess.length} representative sections)...`
        });

        // Process each chunk to extract main content
        for (let i = 0; i < chunksToProcess.length; i++) {
            const chunk = chunksToProcess[i];
            
            // Update progress
            jobStatus.set(jobId, {
                ...jobStatus.get(jobId),
                progress: 20 + Math.floor(30 * (i / chunksToProcess.length)),
                currentChunk: i + 1,
                message: `Processing section ${i + 1}/${chunksToProcess.length}`
            });

            try {
                // Initial analysis to get basic structure and summary
                const response = await openai.chat.completions.create({
                    model: "gpt-4-turbo-preview",
                    messages: [
                        {
                            role: "system",
                            content: `You are a book analysis assistant. Your task is to extract key information from the text for further detailed analysis. Respond using the function calling format.`
                        },
                        {
                            role: "user",
                            content: `Extract key information from this text for further analysis: ${chunk.substring(0, 5000)}`
                        }
                    ],
                    functions: [
                        {
                            name: "analyze_book_initial",
                            description: "Extract key information from text for further detailed analysis",
                            parameters: {
                                type: "object",
                                properties: {
                                    summary: {
                                        type: "string",
                                        description: "A brief summary of the content"
                                    },
                                    keyThemes: {
                                        type: "array",
                                        items: {
                                            type: "string"
                                        },
                                        description: "Key themes identified in the text"
                                    },
                                    mainIssues: {
                                        type: "string",
                                        description: "Main issues or areas for improvement in the text"
                                    }
                                },
                                required: ["summary", "keyThemes"]
                            }
                        }
                    ],
                    function_call: { name: "analyze_book_initial" },
                    temperature: 0.5,
                    max_tokens: 1000,
                });

                const functionCall = response.choices[0]?.message?.function_call;
                if (!functionCall || functionCall.name !== "analyze_book_initial") {
                    throw new Error("Invalid function call response");
                }

                let initialContent;
                try {
                    initialContent = JSON.parse(functionCall.arguments);
                } catch (parseError) {
                    console.error(`Failed to parse function arguments for chunk ${i + 1}:`, functionCall.arguments);
                    throw new Error(`Invalid JSON in function arguments: ${parseError.message}`);
                }

                // Combine initial results
                combinedSummary += initialContent.summary ? initialContent.summary + "\n" : "";
            } catch (error) {
                console.error(`Error processing initial analysis for chunk ${i + 1}:`, error);
                // Continue processing despite errors
            }
        }

        // Parameters to analyze separately
        const parameters = [
            "Readability Score",
            "Content Originality",
            "Plagiarism Detection",
            "Sentiment Analysis",
            "Keyword Density",
            "Topic Relevance",
            "Writing Style",
            "Grammar & Syntax",
            "Structure Quality",
            "Formatting Consistency",
            "Engagement Level",
            "Narrative Flow",
            "Complexity Level",
            "Technical Depth",
            "Character Development",
            "Plot Coherence",
            "Setting & World-building",
            "Dialogue Quality",
            "Pacing & Rhythm",
            "Target Audience Appropriateness"
        ];
        
        // Process each parameter separately to ensure detailed analysis
        for (let paramIdx = 0; paramIdx < parameters.length; paramIdx++) {
            const parameter = parameters[paramIdx];
            
            // Update progress
            jobStatus.set(jobId, {
                ...jobStatus.get(jobId),
                progress: 50 + Math.floor(40 * (paramIdx / parameters.length)),
                message: `Performing detailed analysis of ${parameter}...`
            });
            
            let parameterJustification = "";
            
            try {
                // Analyze specific parameter in detail
                const response = await openai.chat.completions.create({
                    model: "gpt-4-turbo-preview",
                    messages: [
                        {
                            role: "system",
                            content: `You are a book analysis assistant specializing in ${parameter}. Your task is to provide around 200 words of unique, detailed analysis specifically about this aspect of the book. Your analysis should be insightful and valuable to authors.`
                        },
                        {
                            role: "user",
                            content: `Based on this text, provide about 200 words of detailed analysis about the "${parameter}" aspect. Be thorough and specific: ${chunksToProcess[0].substring(0, 3000)}`
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 1000,
                });
                
                parameterJustification = response.choices[0]?.message?.content || "";
                
                // Add this parameter to combined analysis
                combinedAnalysis.push({
                    Parameter: parameter,
                    Score: Math.floor(Math.random() * 3) + 3, // Random score between 3-5 for demonstration
                    Justification: parameterJustification
                });
                
            } catch (error) {
                console.error(`Error processing detailed analysis for parameter ${parameter}:`, error);
                // Add a default entry if there was an error
                combinedAnalysis.push({
                    Parameter: parameter,
                    Score: 3,
                    Justification: `Analysis could not be completed for ${parameter}.`
                });
            }
        }
        
        // Generate final constructive criticism
        try {
            const criticismResponse = await openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                    {
                        role: "system",
                        content: `You are a book editing expert. Your task is to provide about 500 words of detailed, constructive criticism that would help the author improve their book. Be specific, balanced, and genuinely helpful.`
                    },
                    {
                        role: "user",
                        content: `Based on this text, provide about 500 words of detailed constructive criticism to help the author improve their work: ${chunksToProcess[0].substring(0, 3000)}`
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000,
            });
            
            combinedCriticism = criticismResponse.choices[0]?.message?.content || "";
        } catch (error) {
            console.error("Error generating constructive criticism:", error);
            combinedCriticism = "Could not generate constructive criticism.";
        }
        
        // Generate prologue
        try {
            const prologueResponse = await openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                    {
                        role: "system",
                        content: `You are a book prologue expert. Your task is to create a compelling prologue (300-400 words) that captures the essence of the book.`
                    },
                    {
                        role: "user",
                        content: `Based on this text, create a compelling prologue (300-400 words) that captures the essence of the book: ${chunksToProcess[0].substring(0, 3000)}`
                    }
                ],
                temperature: 0.8,
                max_tokens: 2000,
            });
            
            combinedPrologue = prologueResponse.choices[0]?.message?.content || "";
        } catch (error) {
            console.error("Error generating prologue:", error);
            combinedPrologue = "Could not generate prologue.";
        }

        // Generate CSV content
        const csvContent = generateCSV(combinedAnalysis);
        
        // Prepare final result
        const finalResult = {
            status: 'completed',
            progress: 100,
            message: 'Analysis complete',
            analysis: combinedAnalysis,
            summary: combinedSummary.trim(),
            prologue: combinedPrologue.trim(),
            constructiveCriticism: combinedCriticism.trim(),
            csvContent,
            completed: true,
            fileName
        };
        
        // Store the result for retrieval by the finalResult endpoint
        storeResult(jobId, finalResult);
        
        // Set final status in job status (for local development)
        jobStatus.set(jobId, finalResult);
        
    } catch (error) {
        console.error("Processing error:", error);
        const errorResult = {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            message: 'Processing failed'
        };
        
        jobStatus.set(jobId, errorResult);
        
        // Store error result for retrieval
        storeResult(jobId, errorResult);
    }
}

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        
        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Generate a unique job ID using timestamp and random string
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        
        // Store initial job status
        jobStatus.set(jobId, {
            status: 'uploading',
            progress: 0,
            message: 'File received, extracting text...',
            fileInfo: {
                name: file.name,
                size: file.size,
                type: file.type
            }
        });

        // Start file processing without waiting for completion
        (async () => {
            try {
                // Get file content
                const bytes = await file.arrayBuffer();
                const buffer = Buffer.from(bytes);
                let text = "";

                // Update status
                jobStatus.set(jobId, {
                    ...jobStatus.get(jobId),
                    status: 'extracting',
                    progress: 10,
                    message: 'Extracting text from file...'
                });

                // Extract text based on file type
                if (file.name.endsWith(".pdf")) {
                    const pdf = await pdfParse(buffer);
                    text = pdf.text;
                } else if (file.name.endsWith(".docx")) {
                    const result = await mammoth.extractRawText({ buffer });
                    text = result.value;
                }

                // Update status before processing
                jobStatus.set(jobId, {
                    ...jobStatus.get(jobId),
                    status: 'preprocessing',
                    progress: 15,
                    message: 'Text extracted, preparing for analysis...',
                    textLength: text.length
                });

                // Start processing asynchronously
                processFileAsync(jobId, text, file.name);
                
            } catch (error) {
                console.error("Error in background processing:", error);
                const errorResult = {
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    message: 'File processing failed'
                };
                
                jobStatus.set(jobId, errorResult);
                storeResult(jobId, errorResult);
            }
        })();

        // Return immediately with job ID
        return NextResponse.json({ 
            success: true, 
            jobId,
            message: "File uploaded. Processing has started."
        });
        
    } catch (error) {
        console.error("Error:", error);
        return NextResponse.json({ 
            error: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
    }
} 