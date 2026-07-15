import { useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useAskLedgerAssistantMutation } from '../api';
import { PageHeader } from '../components/ui/PageHeader';
import { getErrorMessage } from '../utils/errors';
import { gradientButtonSx } from '../theme/buttonStyles';
import { tokens } from '../theme/tokens';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  answered?: boolean;
}

const EXAMPLES = [
  'How much do we owe Metro Logistics?',
  'Show overdue invoices over $5,000',
  'List all sent invoices',
  'Show invoices for Raj Transport',
];

export function AssistantPage() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Ask about vendor balances, overdue invoices, or invoices by status. I only run a fixed set of safe read queries — I cannot change the ledger.',
      answered: true,
    },
  ]);
  const [askAssistant, { isLoading }] = useAskLedgerAssistantMutation();

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion('');

    try {
      const result = await askAssistant(trimmed).unwrap();
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: result.answer,
          answered: result.answered,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          text: getErrorMessage(error),
          answered: false,
        },
      ]);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <PageHeader
        title="Ledger assistant"
        subtitle="Natural-language questions over invoices and payables — read-only, fixed query set"
      />

      <Alert severity="info" sx={{ mb: 2, borderRadius: 0 }}>
        Supported examples: vendor balances, overdue invoices (optional minimum amount), invoices by
        status, invoices for a vendor. No arbitrary SQL and no writes.
      </Alert>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {EXAMPLES.map((example) => (
          <Button
            key={example}
            size="small"
            variant="outlined"
            onClick={() => setQuestion(example)}
            sx={{ borderRadius: 0, textTransform: 'none' }}
          >
            {example}
          </Button>
        ))}
      </Stack>

      <Box
        sx={{
          flex: 1,
          minHeight: 320,
          maxHeight: 'calc(100vh - 360px)',
          overflow: 'auto',
          border: `1px solid ${tokens.color.border}`,
          bgcolor: tokens.color.surface,
          p: 2,
          mb: 2,
        }}
      >
        <Stack spacing={1.5}>
          {messages.map((message) => (
            <Box
              key={message.id}
              sx={{
                alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                px: 1.5,
                py: 1.25,
                bgcolor:
                  message.role === 'user' ? tokens.color.primaryMuted : tokens.color.surfaceMuted,
                border: `1px solid ${tokens.color.borderSubtle}`,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mb: 0.5,
                  fontWeight: 600,
                  color: tokens.color.inkMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {message.role === 'user' ? 'You' : 'Assistant'}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {message.text}
              </Typography>
            </Box>
          ))}
          {isLoading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                Looking that up…
              </Typography>
            </Stack>
          ) : null}
        </Stack>
      </Box>

      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr auto' },
          gap: 1.5,
          alignItems: 'start',
          p: { xs: 2, sm: 2.5 },
          bgcolor: tokens.color.primaryMuted,
          border: `1px solid ${tokens.color.border}`,
          borderTop: `3px solid ${tokens.color.accent}`,
          boxShadow: tokens.shadow.card,
          position: 'sticky',
          bottom: 0,
          zIndex: 10,
        }}
      >
        <TextField
          label="Ask a question"
          placeholder="e.g. How much do we owe Metro Logistics?"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void handleSubmit();
            }
          }}
          fullWidth
          multiline
          minRows={2}
          disabled={isLoading}
          helperText="Press Enter to ask · Shift+Enter for a new line"
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: tokens.color.surface,
              borderRadius: '6px',
              '& fieldset': {
                borderColor: tokens.color.border,
                borderWidth: 1,
              },
              '&:hover fieldset': {
                borderColor: tokens.color.inkMuted,
              },
              '&.Mui-focused': {
                boxShadow: 'none',
              },
              '&.Mui-focused fieldset': {
                borderColor: tokens.color.accent,
                borderWidth: 1,
              },
            },
          }}
        />
        <Button
          type="submit"
          variant="contained"
          startIcon={<SendIcon />}
          disabled={isLoading || !question.trim()}
          sx={{
            ...gradientButtonSx,
            height: { sm: 56 },
            minWidth: 120,
            borderRadius: '6px',
          }}
        >
          Ask
        </Button>
      </Box>
    </Box>
  );
}
