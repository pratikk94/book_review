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

export async function POST(req: NextRequest) {
  console.log("API route hit: /api-route/analyze");
  
  try {
    // Parse the form data
    const formData = await req.formData();
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

    // Create an array to store analysis results
    let analysis: Array<{ Parameter: string; Score: number; Justification: string }> = [];
    let summary = "";
    let prologue = "";
    let constructiveCriticism = "";
    
    // List of parameters to analyze
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
    
    // Process parameters one by one to ensure detailed analysis
    console.log("Starting parameter-by-parameter analysis");
    
    // First, get a general summary
    try {
      const summaryResponse = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          { 
            role: "system", 
            content: "You are a book analysis assistant. Provide a comprehensive summary of the book content."
          },
          { 
            role: "user", 
            content: `Provide a detailed summary (300-500 words) of this book: ${text.slice(0, 6000)}` 
          }
        ],
        temperature: 0.7,
        max_tokens: 3000,
      });
      
      summary = summaryResponse.choices[0]?.message?.content || "";
      console.log("Summary generated, length:", summary.length);
    } catch (error) {
      console.error("Error generating summary:", error);
      summary = "Could not generate summary due to an error.";
    }
    
    // Generate prologue
    try {
      const prologueResponse = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          { 
            role: "system", 
            content: "You are a book prologue expert. Create a compelling prologue that captures the essence of the book."
          },
          { 
            role: "user", 
            content: `Create a compelling prologue (300-500 words) for this book: ${text.slice(0, 5000)}` 
          }
        ],
        temperature: 0.8,
        max_tokens: 2000,
      });
      
      prologue = prologueResponse.choices[0]?.message?.content || "";
      console.log("Prologue generated, length:", prologue.length);
    } catch (error) {
      console.error("Error generating prologue:", error);
      prologue = "Could not generate prologue due to an error.";
    }
    
    // Process each parameter separately
    for (const parameter of parameters) {
      console.log(`Analyzing parameter: ${parameter}`);
      
      try {
        const paramResponse = await openai.chat.completions.create({
          model: "gpt-4-turbo-preview",
          messages: [
            {
              role: "system",
              content: `You are a book analysis expert specializing in ${parameter}. Provide a concise yet insightful analysis with AROUND 200 WORDS about this aspect. Be thorough and provide unique content.`
            },
            {
              role: "user",
              content: `Analyze this book text specifically for the "${parameter}" aspect. Provide about 200 words of detailed, unique analysis:
              
              ${text.slice(0, 5000)}`
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        });
        
        const justification = paramResponse.choices[0]?.message?.content || "";
        console.log(`Parameter ${parameter} analyzed, response length:`, justification.length);
        
        // Random score between 1-5 for demonstration
        const score = Math.floor(Math.random() * 5) + 1;
        
        analysis.push({
          Parameter: parameter,
          Score: score,
          Justification: justification
        });
      } catch (error) {
        console.error(`Error analyzing parameter ${parameter}:`, error);
        analysis.push({
          Parameter: parameter,
          Score: 0,
          Justification: `Could not analyze this parameter due to an error.`
        });
      }
    }
    
    // Generate constructive criticism
    try {
      const criticismResponse = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          { 
            role: "system", 
            content: "You are a book editing expert. Provide detailed constructive criticism to help the author improve their book."
          },
          { 
            role: "user", 
            content: `Provide detailed constructive criticism (about 500 words) for this book, focusing on how the author could improve it: ${text.slice(0, 5000)}` 
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });
      
      constructiveCriticism = criticismResponse.choices[0]?.message?.content || "";
      console.log("Constructive criticism generated, length:", constructiveCriticism.length);
    } catch (error) {
      console.error("Error generating constructive criticism:", error);
      constructiveCriticism = "Could not generate constructive criticism due to an error.";
    }

    // Generate CSV
    let csvData = "";
    try {
      csvData = parse(analysis);
    } catch (csvError) {
      console.error("Error generating CSV:", csvError);
      csvData = "Parameter,Score,Justification\nError,0,Failed to generate CSV report";
    }
    
    const csvPath = join(publicDir, 'report.csv');
    
    // Write CSV to file
    try {
      writeFileSync(csvPath, csvData);
      console.log("CSV file created:", csvPath);
    } catch (error) {
      console.error("Error writing CSV file:", error);
      return NextResponse.json({ error: "Failed to create CSV report" }, { status: 500 });
    }

    // Prepare final result with additional data
    const result = {
      analysis,
      downloadLink: "/report.csv",
      summary,
      prologue,
      constructiveCriticism
    };

    // Return result
    return NextResponse.json(result);
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