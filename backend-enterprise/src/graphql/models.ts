import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class OrgUnitGQL {
  @Field(() => ID) id!: string;
  @Field() code!: string;
  @Field() label!: string;
  @Field() type!: string;
  @Field() path!: string;
}

@ObjectType()
export class ProjetGQL {
  @Field(() => ID) id!: string;
  @Field({ nullable: true }) codeBit?: string;
  @Field() nom!: string;
  @Field() domaine!: string;
  @Field() orgPath!: string;
  @Field(() => Float) budgetMfcfa!: number;
  @Field(() => Int) avancement!: number;
  @Field(() => Float, { nullable: true }) cpi?: number;
  @Field(() => Float, { nullable: true }) spi?: number;
  @Field() statut!: string;
}

@ObjectType()
export class KpiGQL {
  @Field(() => ID) id!: string;
  @Field() code!: string;
  @Field() libelle!: string;
  @Field(() => Float) cible!: number;
  @Field(() => Float) valeur!: number;
  @Field() consolide!: boolean;
}

@ObjectType()
export class ScopeGQL {
  @Field(() => [String]) visiblePaths!: string[];
  @Field() consolide!: boolean;
}
