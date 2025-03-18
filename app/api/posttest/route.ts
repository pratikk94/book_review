import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  console.log("GET /api/posttest");
  return NextResponse.json({ message: "POST test endpoint is working. Send a POST request to test." });
}

export async function POST(request: NextRequest) {
  console.log("POST /api/posttest");
  
  try {
    const formData = await request.formData();
    const data = Object.fromEntries(formData.entries());
    
    return NextResponse.json({ 
      success: true,
      message: "POST request received",
      data
    });
  } catch (error) {
    console.error("Error processing POST request:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
} 