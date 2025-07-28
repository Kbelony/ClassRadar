import "./App.css";
import { Button } from "@/components/ui/button";

function App() {
  return (
    <>
      <h1 className="text-3xl font-bold underline">Vite + React</h1>
      <div className="card">
          <Button variant="outline">Button</Button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
