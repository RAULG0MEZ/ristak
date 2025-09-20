import React from 'react'
import { Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Button } from '../../ui'
import { formatCurrency } from '../../lib/utils'
import { Icons } from '../../icons'
import { useTransactionHistory } from '../../hooks/useTransactionHistory'

const getAvatarBg = (name: string) => {
  // Always use glass-subtle for consistency
  return 'bg-glass-subtle'
}

export function TransactionHistory() {
  const { transactions, loading, error } = useTransactionHistory(10)

  return (
    <Card variant="glass" noPadding>
      <div className="flex items-center justify-between p-4 border-b border-white/[0.08]">
        <h3 className="text-lg font-semibold text-primary">Historial de Transacciones</h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <Icons.calendar className="w-4 h-4 mr-2" />
            Últimos 30 días
          </Button>
          <Button variant="ghost" size="sm">
            <Icons.filter className="w-4 h-4 mr-2" />
            Filtrar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="text-secondary">Cargando transacciones...</div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center p-8">
          <div className="text-red-500">{error}</div>
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex items-center justify-center p-8">
          <div className="text-secondary">No hay transacciones en los últimos 30 días</div>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transacción</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Categoría</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-onAccent font-medium ${getAvatarBg(transaction.recipient)}`}>
                      {transaction.recipient.charAt(0)}
                    </div>
                    <div>
                      <span className="font-medium text-primary block">{transaction.recipient}</span>
                      <span className="text-xs text-secondary">{transaction.description}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`font-medium ${transaction.amount > 0 ? 'text-success' : 'text-primary'}`}>
                    {transaction.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(transaction.amount))}
                  </span>
                </TableCell>
                <TableCell>
                  <div>
                    <span className="text-secondary block">{transaction.date}</span>
                    <span className="text-xs text-secondary">{transaction.time}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={
                    transaction.status === 'completed' ? 'success' :
                    transaction.status === 'failed' ? 'destructive' :
                    transaction.status === 'refunded' ? 'secondary' :
                    'default'
                  }>
                    {transaction.status === 'completed' ? 'Completado' :
                     transaction.status === 'failed' ? 'Fallido' :
                     transaction.status === 'refunded' ? 'Reembolsado' :
                     'Pendiente'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}