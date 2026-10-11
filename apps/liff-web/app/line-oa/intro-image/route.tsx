import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export function GET() {
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", padding: 64, backgroundColor: "#FFF5EC", color: "#4B3328", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", width: "52%", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", width: 74, height: 74, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#A55F42", color: "#FFFFFF", fontSize: 40, fontWeight: 800 }}>W</div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>WealthVault</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 49, fontWeight: 800, lineHeight: 1.1 }}><span>Your wealth,</span><span>in one place.</span></div>
          <div style={{ display: "flex", width: 110, height: 8, borderRadius: 8, backgroundColor: "#D98D60" }} />
          <div style={{ display: "flex", fontSize: 25, color: "#8A7163", lineHeight: 1.35 }}>See the whole picture. Share only what you choose.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 23, fontWeight: 700, color: "#A55F42" }}>
          <div style={{ display: "flex", width: 22, height: 22, borderRadius: 11, backgroundColor: "#A55F42" }} />
          TAP TO OPEN THE APP
        </div>
      </div>
      <div style={{ display: "flex", width: "48%", alignItems: "center", justifyContent: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 480, height: 590, borderRadius: 36, padding: 32, backgroundColor: "#FFFFFF", border: "2px solid #EAD7C9", boxShadow: "0 20px 45px #B68D7840", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#9B7E6E", fontSize: 17 }}><span>OVERVIEW</span><span>SAMPLE VIEW</span></div>
          <div style={{ display: "flex", flexDirection: "column", borderRadius: 25, padding: 28, backgroundColor: "#593E33", color: "#FFFFFF", gap: 16 }}>
            <div style={{ display: "flex", fontSize: 19, color: "#E5CBB8" }}>Example net worth</div>
            <div style={{ display: "flex", fontSize: 42, fontWeight: 800 }}>฿ 2,450,000</div>
            <div style={{ display: "flex", height: 9, width: "100%", borderRadius: 8, backgroundColor: "#AF8C78" }}><div style={{ display: "flex", height: 9, width: "78%", borderRadius: 8, backgroundColor: "#EFB58C" }} /></div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 15 }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, borderRadius: 19, padding: 20, backgroundColor: "#E9F2E9", gap: 12 }}><span style={{ fontSize: 18, color: "#5C7862" }}>ASSETS</span><span style={{ fontSize: 28, fontWeight: 800, color: "#3B6247" }}>+ 78%</span></div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, borderRadius: 19, padding: 20, backgroundColor: "#FFF0E6", gap: 12 }}><span style={{ fontSize: 18, color: "#A7795C" }}>DEBTS</span><span style={{ fontSize: 28, fontWeight: 800, color: "#9D5D43" }}>22%</span></div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", borderRadius: 19, padding: 20, backgroundColor: "#FBF5EF", gap: 15 }}>
            <div style={{ display: "flex", fontSize: 17, color: "#8D7363" }}>YOUR SPACE</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ display: "flex", width: 22, height: 22, borderRadius: 11, backgroundColor: "#7FAE87" }} /><span style={{ display: "flex", fontSize: 20, color: "#624B3E" }}>Assets in one view</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ display: "flex", width: 22, height: 22, borderRadius: 11, backgroundColor: "#E8AA80" }} /><span style={{ display: "flex", fontSize: 20, color: "#624B3E" }}>Share with control</span></div>
          </div>
        </div>
      </div>
    </div>,
    { width: 1200, height: 784, headers: { "Cache-Control": "public, max-age=86400" } }
  );
}
