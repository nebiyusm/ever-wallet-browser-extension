import type {
    ClockWithOffset,
    ContractState,
    ContractType,
    GqlConnection,
    JrpcConnection,
    MultisigPendingTransaction,
    TonWallet,
    Transaction,
} from '@wallet/nekoton-wasm'

import { isSimpleWallet } from '@app/shared/contracts'

import { ContractSubscription, IContractHandler } from '../../utils/ContractSubscription'
import { ConnectionController } from '../ConnectionController'

export interface IEverWalletHandler extends IContractHandler<Transaction> {
    onUnconfirmedTransactionsChanged(unconfirmedTransactions: MultisigPendingTransaction[]): void;

    onCustodiansChanged(custodians: string[]): void;
}

export class EverWalletSubscription extends ContractSubscription<TonWallet> {

    private readonly _contractType: ContractType

    private readonly _handler: IEverWalletHandler

    private _lastTransactionLt?: string

    private _hasCustodians: boolean = false

    private _hasUnconfirmedTransactions: boolean = false

    public static async subscribeByAddress(
        clock: ClockWithOffset,
        connectionController: ConnectionController,
        address: string,
        handler: IEverWalletHandler,
    ) {
        const {
            connection: {
                data: { transport, connection },
            },
            release,
        } = await connectionController.acquire()

        try {
            const everWallet = await transport.subscribeToNativeWalletByAddress(address, handler)

            return new EverWalletSubscription(
                clock,
                connection,
                release,
                everWallet.address,
                everWallet,
                handler,
            )
        }
        catch (e: any) {
            release()
            throw e
        }
    }

    public static async subscribe(
        clock: ClockWithOffset,
        connectionController: ConnectionController,
        workchain: number,
        publicKey: string,
        contractType: ContractType,
        handler: IEverWalletHandler,
    ) {
        const {
            connection: {
                data: { transport, connection },
            },
            release,
        } = await connectionController.acquire()

        try {
            const everWallet = await transport.subscribeToNativeWallet(
                publicKey,
                contractType,
                workchain,
                handler,
            )

            return new EverWalletSubscription(
                clock,
                connection,
                release,
                everWallet.address,
                everWallet,
                handler,
            )
        }
        catch (e: any) {
            release()
            throw e
        }
    }

    constructor(
        clock: ClockWithOffset,
        connection: GqlConnection | JrpcConnection,
        release: () => void,
        address: string,
        contract: TonWallet,
        handler: IEverWalletHandler,
    ) {
        super(clock, connection, release, address, contract)
        this._contractType = contract.contractType
        this._handler = handler
    }

    protected async onBeforeRefresh(): Promise<void> {
        const simpleWallet = isSimpleWallet(this._contractType)
        if (simpleWallet && this._hasCustodians) {
            return
        }

        await this._contractMutex.use(async () => {
            if (!this._hasCustodians) {
                const custodians = this._contract.getCustodians()
                if (custodians !== undefined) {
                    this._hasCustodians = true
                    this._handler.onCustodiansChanged(custodians)
                }
            }

            if (simpleWallet) {
                return
            }

            const state: ContractState = this._contract.contractState()
            if (
                state.lastTransactionId?.lt === this._lastTransactionLt
                && !this._hasUnconfirmedTransactions
            ) {
                return
            }
            this._lastTransactionLt = state.lastTransactionId?.lt

            const unconfirmedTransactions = this._contract.getMultisigPendingTransactions()
            this._hasUnconfirmedTransactions = unconfirmedTransactions.length > 0
            this._handler.onUnconfirmedTransactionsChanged(unconfirmedTransactions)
        })
    }

}
