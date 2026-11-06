import type { RefObject } from 'react'
import {
  agentSessionPromptQuestions,
  type AgentSessionPromptResponse
} from '../../../../shared/agent-session/agent-session-question-answer'
import type { StructuredPromptItem } from '../../../../shared/agent-session/view/structured-agent-session-message-projection'
import { chatApprovalFromJournal } from '../../../../shared/native-chat/input/native-chat-interactive-prompt'
import { NativeChatApprovalCard } from './NativeChatApprovalCard'
import { NativeChatStructuredQuestionCard } from './NativeChatStructuredQuestionCard'

/** Answer a prompt at the revision the host showed; refusals leave the card up. */
type Respond = (item: StructuredPromptItem, response: AgentSessionPromptResponse) => void

/** The prompt card that owns the composer region: an approval's options or a question's inputs. */
export function NativeChatStructuredPromptCard({
  prompt,
  respond,
  isSubmitting,
  onCancel,
  shouldFocus,
  answerInputRef
}: {
  prompt: StructuredPromptItem
  respond: Respond
  isSubmitting: boolean
  onCancel: () => void
  shouldFocus: boolean
  answerInputRef: RefObject<HTMLTextAreaElement | null>
}): React.JSX.Element | null {
  const { body } = prompt
  if (body.kind === 'approval') {
    const approval = chatApprovalFromJournal(body)
    return approval ? (
      <NativeChatApprovalCard
        key={`${prompt.itemId}:${prompt.revision}`}
        approval={approval}
        onChoose={(optionId) => respond(prompt, { kind: 'option', optionId })}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
        shouldFocus={shouldFocus}
      />
    ) : null
  }
  return (
    <NativeChatStructuredQuestionCard
      key={`${prompt.itemId}:${prompt.revision}`}
      questions={agentSessionPromptQuestions(body)}
      onAnswer={(answer) => respond(prompt, answer)}
      isSubmitting={isSubmitting}
      onCancel={onCancel}
      shouldFocus={shouldFocus}
      answerInputRef={answerInputRef}
    />
  )
}
