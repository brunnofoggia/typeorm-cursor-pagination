import { map, find } from 'lodash';
import {
    ObjectLiteral,
    OrderByCondition,
    WhereExpressionBuilder,
} from 'typeorm';

import {
    atob,
    btoa,
    encodeByType,
    decodeByType,
} from './utils';
import Paginator, { CursorParam } from './Paginator';

export interface PaginationKeyConfig<Entity extends ObjectLiteral> {
    type: string;
    name: string;
    propertyName: string;
    alias: string;
    entity: Entity;
    entityAlias: string;
    paramAlias: string;
}

export class PaginatorJoin<Entity extends ObjectLiteral> extends Paginator<Entity> {
    protected paginationKeysConfig: PaginationKeyConfig<Entity>[] = [];

    protected buildCursorQuery(where: WhereExpressionBuilder, cursors: CursorParam): void {
        const operator = this.getOperator();
        const params: CursorParam = {};
        let query = '';
        this.paginationKeysConfig.forEach((config: PaginationKeyConfig<Entity>) => {
            params[config.paramAlias] = cursors[config.paramAlias];
            where.orWhere(`${query}${config.entityAlias}.${config.name} ${operator} :${config.paramAlias}`, params);
            query = `${query}${config.entityAlias}.${config.name} = :${config.paramAlias} AND `;
        });
    }

    protected buildOrder(): OrderByCondition {
        let { order } = this;

        if (!this.hasAfterCursor() && this.hasBeforeCursor()) {
            order = this.flipOrder(order);
        }

        const orderByCondition: OrderByCondition = {};
        this.paginationKeysConfig.forEach((config: PaginationKeyConfig<Entity>) => {
            orderByCondition[`"${config.entityAlias}"."${config.name}"`] = order;
        });

        return orderByCondition;
    }

    protected encode(entity: Entity): string {
        const payload = this.paginationKeysConfig
            .map((config: PaginationKeyConfig<Entity>) => {
                const type = config.type;
                const value = encodeByType(type, entity[config.alias]);
                const column = `${config.alias}:${value}`;

                return column;
            })
            .join(',');

        return btoa(payload);
    }

    protected decode(cursor: string): CursorParam {
        const cursors: CursorParam = {};
        const columns = atob(cursor).split(',');
        columns.forEach((column) => {
            const [alias, raw] = column.split(':');
            const config: PaginationKeyConfig<Entity> = find(this.paginationKeysConfig, { alias }) as PaginationKeyConfig<Entity>;
            const type = config.type;

            const value = decodeByType(type, raw);
            cursors[config.paramAlias] = value;
        });

        return cursors;
    }

    protected getEntityPropertyType(key: string, entity: Entity | null = null): string {
        return Reflect.getMetadata(
            'design:type',
            (entity || this.entity).prototype,
            key,
        ).name.toLowerCase();
    }

    public setPaginationKeys(paginationKeys: Extract<string, PaginationKeyConfig<Entity>>[]): void {
        const configs = map(paginationKeys, (key): PaginationKeyConfig<Entity> => {
            const config: Partial<PaginationKeyConfig<Entity>> = typeof key === 'string' ? { name: key } : key;

            config.entity = (config.entity ? config.entity : this.entity) as Entity;
            config.entityAlias = config.entityAlias || (config.entity.name === this.entity.name ? this.alias : config.entity.name.toLowerCase());
            config.alias = config.alias || config.name;
            config.propertyName = config.propertyName || config.name;
            // config.alias = config.alias || `"${config.entityAlias}"."${config.name}"`;
            config.paramAlias = `_${config.entityAlias}_${config.name}`;
            config.type = this.getEntityPropertyType(config.propertyName as string, config.entity);

            return config as PaginationKeyConfig<Entity>;
        });

        this.paginationKeysConfig = configs as PaginationKeyConfig<Entity>[];
    }
}
