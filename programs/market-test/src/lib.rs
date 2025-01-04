use anchor_lang::prelude::*;
use anchor_spl::token;

declare_id!("8HePVemepFh6CRn9t1kQRgyWrMjr4rjatQCC2t7N7gEw");

#[program]
pub mod market_test {
    use super::*;

    pub fn initialize(ctx: Context<CreateMarketId>) -> Result<()> {
        // msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateMarketId <'info> {
    pub user: Signer<'info>,
}

impl  <'info> CreateMarketId <'info> {
    pub fn create_id(&mut self) -> Result<()> {
        Ok(())
    }
    
}

pub struct Initialize {}
