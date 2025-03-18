import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFileSync } from "fs";
import { join } from "path";
import { default as pdfParse } from "pdf-parse";
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
  return NextResponse.json({ message: "Analyze API endpoint is working. Send a POST request with a PDF file to analyze." });
}

export async function POST(request: NextRequest) {
  console.log("POST /api/analyze");
  
  try {
    // Parse the form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.log("No file uploaded");
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    console.log("File received:", file.name, file.size);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Parse PDF
    let pdfData;
    try {
      pdfData = await pdfParse(buffer);
    } catch (error) {
      console.error("Error parsing PDF:", error);
      return NextResponse.json({ error: "Failed to parse PDF file" }, { status: 400 });
    }
    
    const text = pdfData.text;
    console.log("Text extracted, length:", text.length);

    // Create OpenAI prompt
    const prompt = `
    Analyze the following eBook based on these 10 parameters. Rate each on a scale of 1-10 and provide justification:
        
    1. Readability Score
    2. Content Originality & Plagiarism Detection
    3. Sentiment Analysis
    4. Keyword Density & Topic Relevance
    5. Writing Style & Grammar Check
    6. Structure & Formatting Quality
    7. Engagement & Readability Flow
    8. Complexity & Technical Depth
    9. Named Entity Recognition (NER) & Topic Categorization
    10. Summary & Key Insights Generation

    Text:
    ${text.slice(0, 5000)}

    Provide the output in JSON format as:
    [
      { "Parameter": "Readability Score", "Score": 8, "Justification": "Clear and well-structured sentences." },
      { "Parameter": "Content Originality & Plagiarism Detection", "Score": 7, "Justification": "Mostly original but some common phrases detected." }
    ]

    Additionally, provide a concise summary of the book (150-200 words) and a compelling prologue (100 words) in this JSON format:
    {
      "summary": "A comprehensive summary of the main points and value of the book...",
      "prologue": "An engaging introduction that captures the essence of the book..."
    }
    `;

    console.log("Calling OpenAI API");
    
    // Call OpenAI
    const response = await openai.chat.completions.create(
      {
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
      },
      {
        timeout: 120000, // 2 minute timeout
      }
    );

    console.log("OpenAI response received");
    
    const responseContent = response.choices[0]?.message?.content || "";
    console.log("Response content:", responseContent);
    
    // Parse the response
    let analysis = [];
    let bookInfo = { summary: "", prologue: "" };
    
    try {
      // Try to parse the entire response as a single JSON object
      const jsonResponse = JSON.parse(responseContent);
      
      if (Array.isArray(jsonResponse)) {
        // The response is just the analysis array
        analysis = jsonResponse;
      } else {
        // The response might contain both parts
        if (jsonResponse.analysis && Array.isArray(jsonResponse.analysis)) {
          analysis = jsonResponse.analysis;
        }
        if (jsonResponse.summary) {
          bookInfo.summary = jsonResponse.summary;
        }
        if (jsonResponse.prologue) {
          bookInfo.prologue = jsonResponse.prologue;
        }
      }
    } catch (parseError) {
      // If it's not a clean JSON, try to extract the parts
      console.log("Couldn't parse as clean JSON, trying to extract parts");
      
      try {
        // Look for array pattern first (analysis)
        const analysisMatch = responseContent.match(/\[\s*\{.*?\}\s*\]/);
        if (analysisMatch) {
          analysis = JSON.parse(analysisMatch[0]);
        }
        
        // Then look for the book info object
        const infoMatch = responseContent.match(/\{\s*\"summary\".*?\}\s*\}/);
        if (infoMatch) {
          bookInfo = JSON.parse(infoMatch[0]);
        }
      } catch (extractError) {
        console.error("Error extracting JSON parts:", extractError);
        return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
      }
    }
    
    // Generate CSV
    const csvData = parse(analysis);
    const csvPath = join(publicDir, 'report.csv');
    
    // Write CSV to file
    try {
      writeFileSync(csvPath, csvData);
      console.log("CSV file created:", csvPath);
    } catch (error) {
      console.error("Error writing CSV file:", error);
      return NextResponse.json({ error: "Failed to create CSV report" }, { status: 500 });
    }

    // Return result with analysis, book info, and download link
    return NextResponse.json({ 
      analysis, 
      summary: bookInfo.summary,
      prologue: bookInfo.prologue,
      downloadLink: "/report.csv" 
    });
  } catch (error) {
    console.error("Error processing request:", error);
    
    // Provide more detailed error information
    let errorMessage = "Internal server error";
    let errorDetails = String(error);
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack || String(error);
    }
    
    return NextResponse.json({ 
      error: errorMessage, 
      details: errorDetails,
      stage: "pdf_processing" // Help identify where the error occurred
    }, { status: 500 });
  }
} 