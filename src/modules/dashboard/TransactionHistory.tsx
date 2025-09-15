import React from 'react'
import { Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Button } from '../../ui'
import { Avatar } from '../../ui'
import { formatCurrency } from '../../lib/utils'
import { Icons } from '../../icons'
import type { Transaction } from '../../types'

const transactions: Transaction[] = [
  {
    id: '1',
    type: 'income',
    recipient: 'Spotify',
    amount: -18.08,
    date: 'Wed 1:00am',
    time: '1:00am',
    category: 'Subscriptions',
    description: 'Monthly subscription',
    status: 'completed',
  },
  {
    id: '2',
    type: 'income',
    recipient: 'Stripe',
    amount: 120.00,
    date: 'Wed 10:30am',
    time: '10:30am',
    category: 'Income',
    description: 'Payment received',
    status: 'completed',
  },
  {
    id: '3',
    type: 'expense',
    recipient: 'A.Coffee',
    amount: -5.50,
    date: 'Wed 3:20am',
    time: '3:20am',
    category: 'Food and dining',
    description: 'Morning coffee',
    status: 'completed',
  },
  {
    id: '4',
    type: 'income',
    recipient: 'Stripe',
    amount: 86.00,
    date: 'Wed 2:45am',
    time: '2:45am',
    category: 'Income',
    description: 'Payment received',
    status: 'completed',
  },
  {
    id: '5',
    type: 'expense',
    recipient: 'Figma',
    amount: -15.00,
    date: 'Tue 8:10pm',
    time: '8:10pm',
    category: 'Subscriptions',
    description: 'Monthly subscription',
    status: 'completed',
  },
]

const getAvatarBg = (name: string) => {
  // Always use glass-subtle for consistency
  return 'bg-glass-subtle'
}

export function TransactionHistory() {
  return (
    <Card variant="glass" noPadding>
      <div className="flex items-center justify-between p-4 border-b border-white/[0.08]">
        <h3 className="text-lg font-semibold text-primary">Transaction history</h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <Icons.calendar className="w-4 h-4 mr-2" />
            Select dates
          </Button>
          <Button variant="ghost" size="sm">
            <Icons.filter className="w-4 h-4 mr-2" />
            Apply filter
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Transaction</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Category</TableHead>
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
                  <span className="font-medium text-primary">{transaction.recipient}</span>
                </div>
              </TableCell>
              <TableCell>
                <span className={`font-medium ${transaction.amount > 0 ? 'text-success' : 'text-primary'}`}>
                  {transaction.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(transaction.amount))}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-secondary">{transaction.date}</span>
              </TableCell>
              <TableCell>
                <Badge variant={transaction.amount > 0 ? 'success' : 'default'}>
                  {transaction.category}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}