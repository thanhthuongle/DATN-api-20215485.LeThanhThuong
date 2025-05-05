/* eslint-disable no-console */
import { banks } from '~/data/banks'
import { bankModel } from '~/models/bankModel'

export const seedBanksIfEmpty = () => {
  bankModel.seedBanksIfEmpty(banks)
}
