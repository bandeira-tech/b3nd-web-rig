import { Route, Routes } from "react-router-dom";
import { AppsBrowser } from "./AppsBrowser";
import { AppHost } from "./AppHost";

export function AppsLayoutSlot() {
  return (
    <div className="h-full overflow-y-auto" data-testid="apps-layout">
      <Routes>
        <Route index element={<AppsBrowser />} />
        <Route path=":slug" element={<AppHost />} />
      </Routes>
    </div>
  );
}
