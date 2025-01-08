use anchor_lang::{accounts::signer, prelude::*};
use anchor_spl::{
    dex::{initialize_market, Dex, InitializeMarket, InitializeMarketBumps},
    token::{Mint, Token, TokenAccount},
};

use std::mem::size_of;

declare_id!("Az88Wvk5gVMqFc7QQ94NqSa3sVCjnoQhjfNdqiti26fu");

#[program]
pub mod market_test {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        coin_lot_size: u64,
        pc_lot_size: u64,
        pc_dust_threshold: u64,
        vault_signer_nonce: u64,
    ) -> Result<()> {
        ctx.accounts.initialize(
            coin_lot_size,
            pc_lot_size,
            pc_dust_threshold,
            vault_signer_nonce,
        )
    }
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct Initialize<'info> {
    // Removed lifetime parameter
    #[account(mut)]
    ///CHECKED
    pub market: UncheckedAccount<'info>,

    #[account(mut)]
    ///CHECKED
    pub event_queue: UncheckedAccount<'info>,

    #[account(mut)]
    ///CHECKED
    pub req_queue: UncheckedAccount<'info>,

    #[account(mut)]
    ///CHECKED
    pub bids: UncheckedAccount<'info>,

    #[account(mut)]
    ///CHECKED
    pub asks: UncheckedAccount<'info>,

    #[account(mut)]
    ///CHECKED
    pub coin_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    ///CHECKED
    pub pc_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub coin_mint: Account<'info, Mint>,

    #[account(mut)]
    pub pc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub openbook_dex: Program<'info, Dex>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> Initialize<'info> {
    pub fn initialize(
        &mut self,
        coin_lot_size: u64,
        pc_lot_size: u64,
        pc_dust_threshold: u64,
        vault_signer_nonce: u64,
    ) -> Result<()> {
        let cpi_accounts = InitializeMarket {
            market: self.market.to_account_info(),
            coin_mint: self.coin_mint.to_account_info(),
            coin_vault: self.coin_vault.to_account_info(),
            pc_mint: self.pc_mint.to_account_info(),
            pc_vault: self.pc_vault.to_account_info(),
            bids: self.bids.to_account_info(),
            asks: self.asks.to_account_info(),
            req_q: self.req_queue.to_account_info(),
            event_q: self.event_queue.to_account_info(),
            rent: self.rent.to_account_info(),
        };
        // let seeds: [&[&[u8]]; 1] = [&[self.market.key().as_ref(), &[bumps.pda_signer]]];
        // // let signer_seeds = &seeds;

        let cpi_ctx = CpiContext::new(self.openbook_dex.to_account_info(), cpi_accounts);
        initialize_market(
            cpi_ctx,
            coin_lot_size,
            pc_lot_size,
            vault_signer_nonce,
            pc_dust_threshold,
        )
    }
}
