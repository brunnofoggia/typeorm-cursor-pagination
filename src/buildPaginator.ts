import { ObjectLiteral, ObjectType } from 'typeorm';

import _Paginator, { Order } from './Paginator';
import { PaginatorJoin } from './PaginatorJoin';

export interface PagingQuery {
    afterCursor?: string;
    beforeCursor?: string;
    limit?: number;
    order?: Order | 'ASC' | 'DESC';
}

export interface PaginationOptions<Entity extends ObjectLiteral> {
    entity: ObjectType<Entity>;
    alias?: string;
    query?: PagingQuery;
    paginationKeys?: any[];
    Paginator?: typeof PaginatorJoin<Entity>,
    getMethod?: string;
}

export function buildPaginator<Entity extends ObjectLiteral>(
    options: PaginationOptions<Entity>,
): _Paginator<Entity> {
    const Paginator = options.Paginator || _Paginator;
    const {
        entity,
        query = {},
        alias = entity.name.toLowerCase(),
        paginationKeys = ['id' as any],
    } = options;

    const paginator = new Paginator(entity);

    if (options.getMethod) paginator.getMethod = options.getMethod;

    paginator.setAlias(alias);

    paginator.setPaginationKeys(paginationKeys as never[]);

    if (query.afterCursor) {
        paginator.setAfterCursor(query.afterCursor);
    }

    if (query.beforeCursor) {
        paginator.setBeforeCursor(query.beforeCursor);
    }

    if (query.limit) {
        paginator.setLimit(query.limit);
    }

    if (query.order) {
        paginator.setOrder(query.order as Order);
    }

    return paginator;
}
