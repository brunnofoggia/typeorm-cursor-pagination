import {
    Brackets,
    ObjectLiteral,
    ObjectType,
    OrderByCondition,
    SelectQueryBuilder,
    WhereExpressionBuilder,
} from 'typeorm';

import {
    atob,
    btoa,
    encodeByType,
    decodeByType,
    pascalToUnderscore,
} from './utils';

export enum Order {
    ASC = 'ASC',
    DESC = 'DESC',
}

export type EscapeFn = (name: string) => string;

export interface CursorParam {
    [key: string]: any;
}

export interface Cursor {
    beforeCursor: string | null;
    afterCursor: string | null;
}

export interface PagingResult<Entity> {
    data: Entity[];
    cursor: Cursor;
}

export default class Paginator<Entity extends ObjectLiteral> {
    protected afterCursor: string | null = null;

    protected beforeCursor: string | null = null;

    protected nextAfterCursor: string | null = null;

    protected nextBeforeCursor: string | null = null;

    protected alias: string = pascalToUnderscore(this.entity.name);

    protected limit = 100;

    protected order: Order = Order.DESC;

    protected paginationKeys: Extract<keyof Entity, string>[] = [];

    public constructor(
        protected entity: ObjectType<Entity>
    ) { }

    public setAlias(alias: string): void {
        this.alias = alias;
    }

    public setAfterCursor(cursor: string): void {
        this.afterCursor = cursor;
    }

    public setBeforeCursor(cursor: string): void {
        this.beforeCursor = cursor;
    }

    public setLimit(limit: number): void {
        this.limit = limit;
    }

    public setOrder(order: Order): void {
        this.order = order;
    }

    public async paginate(
        builder: SelectQueryBuilder<Entity>,
    ): Promise<PagingResult<Entity>> {
        const entities = await this.getPagingResult(this.appendPagingQuery(builder));
        const hasMore = entities.length > this.limit;

        if (hasMore) {
            entities.splice(entities.length - 1, 1);
        }

        if (entities.length === 0) {
            return this.toPagingResult(entities);
        }

        if (!this.hasAfterCursor() && this.hasBeforeCursor()) {
            entities.reverse();
        }

        if (this.hasBeforeCursor() || hasMore) {
            this.nextAfterCursor = this.encode(entities[entities.length - 1]);
        }

        if (this.hasAfterCursor() || (hasMore && this.hasBeforeCursor())) {
            this.nextBeforeCursor = this.encode(entities[0]);
        }

        return this.toPagingResult(entities);
    }

    protected getCursor(): Cursor {
        return {
            afterCursor: this.nextAfterCursor,
            beforeCursor: this.nextBeforeCursor,
        };
    }

    protected appendPagingQuery(
        builder: SelectQueryBuilder<Entity>,
    ): SelectQueryBuilder<Entity> {
        const cursors: CursorParam = {};
        const clonedBuilder = new SelectQueryBuilder<Entity>(builder);

        if (this.hasAfterCursor()) {
            Object.assign(cursors, this.decode(this.afterCursor as string));
        } else if (this.hasBeforeCursor()) {
            Object.assign(cursors, this.decode(this.beforeCursor as string));
        }

        if (Object.keys(cursors).length > 0) {
            clonedBuilder.andWhere(
                new Brackets((where) => this.buildCursorQuery(where, cursors)),
            );
        }

        /* take does not work with joins, using limit instead */
        clonedBuilder.limit(this.limit + 1);

        clonedBuilder.orderBy(this.buildOrder());

        return clonedBuilder;
    }

    protected buildCursorQuery(where: WhereExpressionBuilder, cursors: CursorParam): void {
        const operator = this.getOperator();
        const params: CursorParam = {};
        let query = '';
        this.paginationKeys.forEach((key) => {
            params[key] = cursors[key];
            where.orWhere(`${query}${this.alias}.${key} ${operator} :${key}`, params);
            query = `${query}${this.alias}.${key} = :${key} AND `;
        });
    }

    protected getOperator(): string {
        if (this.hasAfterCursor()) {
            return this.order === Order.ASC ? '>' : '<';
        }

        if (this.hasBeforeCursor()) {
            return this.order === Order.ASC ? '<' : '>';
        }

        return '=';
    }

    protected buildOrder(): OrderByCondition {
        let { order } = this;

        if (!this.hasAfterCursor() && this.hasBeforeCursor()) {
            order = this.flipOrder(order);
        }

        const orderByCondition: OrderByCondition = {};
        this.paginationKeys.forEach((key) => {
            orderByCondition[`${this.alias}.${key}`] = order;
        });

        return orderByCondition;
    }

    protected hasAfterCursor(): boolean {
        return this.afterCursor !== null;
    }

    protected hasBeforeCursor(): boolean {
        return this.beforeCursor !== null;
    }

    protected encode(entity: Entity): string {
        const payload = this.paginationKeys
            .map((key) => {
                const type = this.getEntityPropertyType(key);
                const value = encodeByType(type, entity[key]);
                return `${key}:${value}`;
            })
            .join(',');

        return btoa(payload);
    }

    protected decode(cursor: string): CursorParam {
        const cursors: CursorParam = {};
        const columns = atob(cursor).split(',');
        columns.forEach((column) => {
            const [key, raw] = column.split(':');
            const type = this.getEntityPropertyType(key);
            const value = decodeByType(type, raw);
            cursors[key] = value;
        });

        return cursors;
    }

    protected getEntityPropertyType(key: string): string {
        return Reflect.getMetadata(
            'design:type',
            this.entity.prototype,
            key,
        ).name.toLowerCase();
    }

    protected flipOrder(order: Order): Order {
        return order === Order.ASC ? Order.DESC : Order.ASC;
    }

    protected toPagingResult<Entity>(entities: Entity[]): PagingResult<Entity> {
        return {
            data: entities,
            cursor: this.getCursor(),
        };
    }

    /* get method abstraction */
    public getMethod = 'getMany';
    protected getPagingResult(queryBuilder: SelectQueryBuilder<Entity>) {
        // @ts-ignore
        return queryBuilder[this.getMethod]();
    }

    public setPaginationKeys(paginationKeys: Extract<keyof Entity, string>[]) {
        this.paginationKeys = paginationKeys;
    }
}
