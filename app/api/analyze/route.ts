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

// Add a simple GET handler for testing
export async function GET() {
  console.log("GET /api/analyze");
  return NextResponse.json({ message: "Analyze API endpoint is working. Send a POST request with a PDF or DOCX file to analyze." });
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
    const CHUNK_SIZE = 15000;
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

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        
        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Get file content
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        let text = "";

        // Extract text based on file type
        if (file.name.endsWith(".pdf")) {
            const pdf = await pdfParse(buffer);
            text = pdf.text;
        } else if (file.name.endsWith(".docx")) {
            const result = await mammoth.extractRawText({ buffer });
            text = result.value;
        }

        // Split text into chunks
        const chunks = splitTextIntoChunks(text);
        const chunkStatus: ChunkStatus[] = [];
        let combinedAnalysis: AnalysisItem[] = [];
        let combinedSummary = "";
        let combinedPrologue = "";
        let combinedCriticism = "";

        // Process each chunk
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            chunkStatus.push({
                chunk: i + 1,
                status: 'processing',
                message: `Processing chunk ${i + 1}/${chunks.length}`
            });

            try {
                const response = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo-16k",
                    messages: [
                        {
                            role: "system",
                            content: `You are a book analysis assistant. Your task is to analyze text and provide structured feedback. You must respond using the function calling format with the analyze_book function.`
                        },
                        {
                            role: "user",
                            content: `Analyze this text and provide feedback: ${chunk}`
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
                                required: ["analysis", "summary", "prologue", "constructiveCriticism"]
                            }
                        }
                    ],
                    function_call: { name: "analyze_book" },
                    temperature: 0.3,
                    max_tokens: 2000,
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

                // Validate the response structure
                if (!parsedContent.analysis || !Array.isArray(parsedContent.analysis)) {
                    throw new Error("Response missing analysis array");
                }

                // Ensure all required fields are present and properly formatted
                const requiredFields = ['summary', 'prologue', 'constructiveCriticism'];
                for (const field of requiredFields) {
                    if (!parsedContent[field]) {
                        parsedContent[field] = `No ${field} provided for this section.`;
                    }
                }

                // Validate analysis array structure
                if (!parsedContent.analysis.every((item: any) => 
                    item.Parameter && 
                    typeof item.Score === 'number' && 
                    item.Justification
                )) {
                    throw new Error("Invalid analysis array structure");
                }

                // Combine results
                if (parsedContent.analysis) {
                    combinedAnalysis = [...combinedAnalysis, ...parsedContent.analysis];
                }
                if (parsedContent.summary) {
                    combinedSummary += parsedContent.summary + "\n";
                }
                if (parsedContent.prologue) {
                    combinedPrologue += parsedContent.prologue + "\n";
                }
                if (parsedContent.constructiveCriticism) {
                    combinedCriticism += parsedContent.constructiveCriticism + "\n";
                }

                chunkStatus[i].status = 'completed';
                chunkStatus[i].message = `Chunk ${i + 1}/${chunks.length} completed successfully`;

                // Add delay between chunks to avoid rate limits
                if (i < chunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between chunks
                }
            } catch (error) {
                console.error(`Error processing chunk ${i + 1}:`, error);
                chunkStatus[i].status = 'error';
                chunkStatus[i].message = `Error processing chunk ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                
                // Retry the chunk once with a simpler prompt
                try {
                    console.log(`Retrying chunk ${i + 1}...`);
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
                    const retryResponse = await openai.chat.completions.create({
                        model: "gpt-3.5-turbo-16k",
                        messages: [
                            {
                                role: "system",
                                content: "You are a book analysis assistant. Your task is to analyze text and provide structured feedback. You must respond using the function calling format with the analyze_book function."
                            },
                            {
                                role: "user",
                                content: `Analyze this text and provide feedback: ${chunk}`
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
                                    required: ["analysis", "summary", "prologue", "constructiveCriticism"]
                                }
                            }
                        ],
                        function_call: { name: "analyze_book" },
                        temperature: 0.1,
                        max_tokens: 2000,
                    });

                    const retryFunctionCall = retryResponse.choices[0]?.message?.function_call;
                    if (!retryFunctionCall || retryFunctionCall.name !== "analyze_book") {
                        throw new Error("Invalid function call response in retry");
                    }

                    const retryParsedContent = JSON.parse(retryFunctionCall.arguments);
                    
                    // Validate retry response
                    if (!retryParsedContent.analysis || !Array.isArray(retryParsedContent.analysis)) {
                        throw new Error("Retry response missing analysis array");
                    }

                    // Combine retry results
                    if (retryParsedContent.analysis) {
                        combinedAnalysis = [...combinedAnalysis, ...retryParsedContent.analysis];
                    }
                    if (retryParsedContent.summary) {
                        combinedSummary += retryParsedContent.summary + "\n";
                    }
                    if (retryParsedContent.prologue) {
                        combinedPrologue += retryParsedContent.prologue + "\n";
                    }
                    if (retryParsedContent.constructiveCriticism) {
                        combinedCriticism += retryParsedContent.constructiveCriticism + "\n";
                    }

                    chunkStatus[i].status = 'completed';
                    chunkStatus[i].message = `Chunk ${i + 1}/${chunks.length} completed successfully after retry`;
                } catch (retryError) {
                    console.error(`Retry failed for chunk ${i + 1}:`, retryError);
                    chunkStatus[i].message = `Failed after retry: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`;
                }
            }
        }

        // Generate CSV file
        const csvContent = generateCSV(combinedAnalysis);
        const csvBuffer = Buffer.from(csvContent);
        const csvBlob = new Blob([csvBuffer], { type: 'text/csv' });
        const csvUrl = URL.createObjectURL(csvBlob);

        return NextResponse.json({
            analysis: combinedAnalysis,
            summary: combinedSummary.trim(),
            prologue: combinedPrologue.trim(),
            constructiveCriticism: combinedCriticism.trim(),
            downloadLink: csvUrl,
            chunkStatus
        });
    } catch (error) {
        console.error("Error:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
} 