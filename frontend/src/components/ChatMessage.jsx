import './ChatMessage.css'
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css'; // Import KaTeX CSS for styling

function ChatMessage({ message }) {
  const mathText = message.text.trim().replace(/^\$+/, '').replace(/\$+$/, '');

  return (
    <div className={`message ${message.role}`}>
      <div className="message-bubble">
        {message.role === 'user' ? (
          <InlineMath math={mathText} />
        ) : (
          message.text
        )}
      </div>
    </div>
  );
}

export default ChatMessage