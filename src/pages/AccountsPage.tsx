import { CollectionCard, CollectionPage } from "../components/CollectionPage";
import { BankLogo } from "../components/BankLogo";
import type { Account, CustomBank } from "../types/finance";
import { money } from "../utils/format";

// Contas disponíveis e saldo consolidado do usuário.
export function AccountsPage({ accounts, customBanks, onAdd, onEdit, onDelete }: {
  accounts: Account[];
  customBanks: CustomBank[];
  onAdd: () => void;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
}) {
  const total = accounts.reduce((sum, account) => sum + account.balance, 0);
  return (
    <CollectionPage eyebrow="FLUXARY.IA · SEU DINHEIRO" title="Contas" description={`Saldo total: ${money.format(total)}. Organize suas contas em um só lugar.`} action={onAdd} empty={accounts.length === 0}>
      {accounts.map((account) => (
        <CollectionCard key={account.id} icon={<BankLogo bankId={account.bankId} customBanks={customBanks} />} title={account.name} subtitle={account.institution} value={money.format(account.balance)} onEdit={() => onEdit(account)} onDelete={() => onDelete(account)} />
      ))}
    </CollectionPage>
  );
}
