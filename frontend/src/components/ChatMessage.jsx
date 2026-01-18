import './ChatMessage.css'

function ChatMessage({ message }) {
  return (
    <div className={`message ${message.role}`}>
      <div className="message-bubble">
        {message.text}
      </div>
    </div>
  )
}

export default ChatMessage
