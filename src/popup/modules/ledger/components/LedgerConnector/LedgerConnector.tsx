import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useEffect, useRef } from 'react'
import { useIntl } from 'react-intl'

import { LEDGER_BRIDGE_URL } from '@app/shared'
import {
    Button, ErrorMessage, Notification, useViewModel,
} from '@app/popup/modules/shared'

import { PanelLoader } from '../PanelLoader'
import { LedgerConnectorViewModel } from './LedgerConnectorViewModel'

import './LedgerConnector.scss'

interface Props {
    theme?: 'sign-in';
    onNext: () => void;
    onBack: () => void;
}

export const LedgerConnector = observer(({ onNext, onBack, theme }: Props) => {
    const vm = useViewModel(LedgerConnectorViewModel)
    const intl = useIntl()
    const ref = useRef<HTMLIFrameElement>(null)

    /**
     * multiple ledger iframe workaround (see LedgerRpcServer)
     * @see {@link LedgerRpcServer}
     */
    const messageHandler = useCallback(async (reply: any) => {
        if (
            typeof reply.data?.action === 'string'
            && reply.data.action.endsWith('-reply')
        ) return

        const success = await vm.handleMessage(reply)

        if (success) {
            onNext?.()
        }
    }, [])

    const handleLoad = useCallback(() => {
        vm.setLoading(false)
        window.addEventListener('message', messageHandler)
    }, [])

    useEffect(() => () => window.removeEventListener('message', messageHandler), [])

    return (
        <>
            <Notification title="Could not connect your Ledger" opened={!!vm.error} onClose={vm.resetError}>
                <ErrorMessage className="ledger-connector__error-message">
                    {vm.error}
                </ErrorMessage>
            </Notification>

            <div className={classNames('ledger-connector', theme)}>
                <div className="ledger-connector__content">
                    {vm.loading && (
                        <PanelLoader
                            paddings={theme !== 'sign-in'}
                            transparent={theme === 'sign-in'}
                        />
                    )}

                    <iframe
                        ref={ref}
                        title="ladger"
                        name="test-ledger-iframe"
                        allow="hid"
                        height="300px"
                        className="ledger-connector__iframe"
                        src={LEDGER_BRIDGE_URL}
                        onLoad={handleLoad}
                    />
                </div>

                <div className="ledger-connector__footer">
                    <Button design="secondary" onClick={onBack}>
                        {intl.formatMessage({ id: 'BACK_BTN_TEXT' })}
                    </Button>
                </div>
            </div>
        </>
    )
})