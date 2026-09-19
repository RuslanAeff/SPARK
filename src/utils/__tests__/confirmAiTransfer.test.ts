import { Alert } from 'react-native';
import { confirmAiTransfer } from '../confirmAiTransfer';
const t = (key: string) => key;
it.each(['cancel', 'dismiss', 'abort', 'send'])('resolves only affirmative consent: %s', async action => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const controller = new AbortController();
  const network = jest.fn();
  const result = confirmAiTransfer(t, 'receipt', controller.signal).then(ok => { if (ok) network(); return ok; });
  expect(network).not.toHaveBeenCalled();
  const [, message, buttons, options] = alert.mock.calls[alert.mock.calls.length - 1];
  expect(message).toBe('ai_transfer_receipt');
  if (action === 'abort') controller.abort();
  else if (action === 'dismiss') options?.onDismiss?.();
  else buttons?.[action === 'send' ? 1 : 0].onPress?.();
  expect(await result).toBe(action === 'send');
  expect(network).toHaveBeenCalledTimes(action === 'send' ? 1 : 0);
  alert.mockRestore();
});
