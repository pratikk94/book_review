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
    // Reduce chunk size to process faster
    const CHUNK_SIZE = 8000; 
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
        const MAX_CHUNKS = 3; // Limit number of chunks to process
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

        // Process each chunk
        for (let i = 0; i < chunksToProcess.length; i++) {
            const chunk = chunksToProcess[i];
            
            // Update progress
            jobStatus.set(jobId, {
                ...jobStatus.get(jobId),
                progress: 20 + Math.floor(60 * (i / chunksToProcess.length)),
                currentChunk: i + 1,
                message: `Processing section ${i + 1}/${chunksToProcess.length}`
            });

            try {
                // Simplified prompt and reduced token count
                const response = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: [
                        {
                            role: "system",
                            content: `You are a book analysis assistant. Your task is to analyze text and provide structured feedback. Respond using the function calling format.`
                        },
                        {
                            role: "user",
                            content: `Analyze this text and provide feedback: ${chunk.substring(0, 4000)}`
                        }
                    ],
                    functions: [
                        {
                            name: "analyze_book",
                            description: "Analyze a section of text and provide structured feedback",
                            parameters: {
                                type: "object",
                                properties: {
                                    analysis: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                Parameter: {
                                                    type: "string",
                                                    enum: ["Readability", "Content Quality", "Structure", "Grammar & Style", "Originality"]
                                                },
                                                Score: {
                                                    type: "number",
                                                    minimum: 1,
                                                    maximum: 5
                                                },
                                                Justification: {
                                                    type: "string"
                                                }
                                            },
                                            required: ["Parameter", "Score", "Justification"]
                                        }
                                    },
                                    summary: {
                                        type: "string"
                                    },
                                    prologue: {
                                        type: "string"
                                    },
                                    constructiveCriticism: {
                                        type: "string"
                                    }
                                },
                                required: ["analysis"]
                            }
                        }
                    ],
                    function_call: { name: "analyze_book" },
                    temperature: 0.3,
                    max_tokens: 1000, // Reduced token count
                });

                const functionCall = response.choices[0]?.message?.function_call;
                if (!functionCall || functionCall.name !== "analyze_book") {
                    throw new Error("Invalid function call response");
                }

                let parsedContent;
                try {
                    parsedContent = JSON.parse(functionCall.arguments);
                } catch (parseError) {
                    console.error(`Failed to parse function arguments for chunk ${i + 1}:`, functionCall.arguments);
                    throw new Error(`Invalid JSON in function arguments: ${parseError.message}`);
                }

                // Ensure all required fields are present with defaults
                parsedContent.summary = parsedContent.summary || "";
                parsedContent.prologue = parsedContent.prologue || "";
                parsedContent.constructiveCriticism = parsedContent.constructiveCriticism || "";
                parsedContent.analysis = parsedContent.analysis || [];

                // Combine results
                combinedAnalysis = [...combinedAnalysis, ...parsedContent.analysis];
                combinedSummary += parsedContent.summary ? parsedContent.summary + "\n" : "";
                combinedPrologue += parsedContent.prologue ? parsedContent.prologue + "\n" : "";
                combinedCriticism += parsedContent.constructiveCriticism ? parsedContent.constructiveCriticism + "\n" : "";

            } catch (error) {
                console.error(`Error processing chunk ${i + 1}:`, error);
                // Continue processing despite errors
            }
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