const { useState, useEffect } = React;

const App = () => {
  const [input, setInput] = useState("");
  const [sessionId] = useState(crypto.randomUUID());
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    try {
      const response = await axios.post("http://localhost:3000/process", {
        text: input,
        sessionId,
        language: "pt",
      });
      setHistory([...history, { user: input, ia: response.data.response, intent: response.data.intent, confidence: response.data.confidence }]);
      setInput("");
    } catch (error) {
      console.error("Erro ao processar entrada:", error);
      setHistory([...history, { user: input, ia: "Erro ao processar. Tente novamente.", intent: "error", confidence: 0 }]);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
      <h1 className="text-3xl font-bold mb-6 text-blue-600">Mini IA</h1>
      <div className="w-full max-w-2xl bg-white shadow-md rounded-lg p-6">
        <div className="h-96 overflow-y-auto mb-4 p-4 bg-gray-50 rounded-lg">
          {history.map((entry, index) => (
            <div key={index} className="mb-4">
              <p className="text-gray-800 font-semibold">Você: {entry.user}</p>
              <p className="text-blue-600">IA: {entry.ia}</p>
              <p className="text-gray-500 text-sm">Intenção: {entry.intent} (Confiança: {(entry.confidence * 100).toFixed(2)}%)</p>
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-grow p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Digite sua mensagem..."
            disabled={isLoading}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
            disabled={isLoading}
          >
            {isLoading ? "Enviando..." : "Enviar"}
          </button>
        </form>
      </div>
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById("root"));