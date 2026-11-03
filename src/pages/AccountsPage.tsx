import { CollectionCard, CollectionPage } from "../components/CollectionPage";
import { BankLogo } from "../components/BankLogo";
import type { Account, CustomBank, Transaction } from "../types/finance";
import { money } from "../utils/format";
import { getAccountBalance } from "../utils/finance";

// Contas disponíveis e saldo consolidado do usuário.
export function AccountsPage({ accounts, customBanks, transactions, onAdd, onEdit, onDelete }: {
  accounts: Account[];
  customBanks: CustomBank[];
  transactions: Transaction[];
  onAdd: () => void;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
}) {
  const total = accounts.reduce((sum, account) => sum + getAccountBalance(account, transactions), 0);
  return (
    <CollectionPage eyebrow="FLUXARY.IA · SEU DINHEIRO" title="Contas" description={`Saldo total: ${money.format(total)}. Organize suas contas em um só lugar.`} action={onAdd} empty={accounts.length === 0}>
      {accounts.map((account) => (
        <CollectionCard key={account.id} icon={<BankLogo bankId={account.bankId} customBanks={customBanks} />} title={account.name} subtitle={account.institution} value={money.format(getAccountBalance(account, transactions))} onEdit={() => onEdit(account)} onDelete={() => onDelete(account)} />
      ))}
    </CollectionPage>
  );
}
