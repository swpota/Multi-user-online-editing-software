/**
 * 虚拟化文档列表组件
 * 使用 react-window 实现高性能长列表渲染
 */
import React from 'react';
import { FixedSizeList } from 'react-window';
import DocumentCard from './DocumentCard';
import DocumentListItem from './DocumentListItem';

/**
 * 虚拟化列表视图
 */
export function VirtualizedListView({ 
  documents, 
  selectedDocs, 
  onSelectDoc, 
  onDeleteDoc, 
  onExportDoc,
  height = 600,
  itemHeight = 80
}) {
  const Row = ({ index, style }) => {
    const doc = documents[index];
    return (
      <div style={style}>
        <DocumentListItem
          doc={doc}
          isSelected={selectedDocs.includes(doc.id)}
          onSelect={onSelectDoc}
          onDelete={onDeleteDoc}
          onExport={onExportDoc}
        />
      </div>
    );
  };

  return (
    <FixedSizeList
      height={height}
      itemCount={documents.length}
      itemSize={itemHeight}
      width="100%"
      className="virtualized-list-view"
    >
      {Row}
    </FixedSizeList>
  );
}

/**
 * 虚拟化网格视图
 * 使用 FixedSizeList 配合 CSS Grid 实现
 */
export function VirtualizedGridView({ 
  documents, 
  selectedDocs, 
  onSelectDoc, 
  onDeleteDoc, 
  onExportDoc,
  height = 600,
  columnCount = 3,
  rowHeight = 280
}) {
  const rowCount = Math.ceil(documents.length / columnCount);

  // 每一行渲染多个卡片
  const Row = ({ index, style }) => {
    const startIdx = index * columnCount;
    const rowDocs = documents.slice(startIdx, startIdx + columnCount);

    return (
      <div style={style}>
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
            gap: '16px',
            padding: '8px'
          }}
        >
          {rowDocs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              isSelected={selectedDocs.includes(doc.id)}
              onSelect={onSelectDoc}
              onDelete={onDeleteDoc}
              onExport={onExportDoc}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <FixedSizeList
      height={height}
      itemCount={rowCount}
      itemSize={rowHeight}
      width="100%"
      className="virtualized-grid-view"
    >
      {Row}
    </FixedSizeList>
  );
}

/**
 * 虚拟化文档列表（统一组件）
 */
const VirtualizedDocumentList = React.memo(function VirtualizedDocumentList({
  documents,
  viewMode,
  selectedDocs,
  onSelectDoc,
  onDeleteDoc,
  onExportDoc,
  useVirtualization = true,
  threshold = 50 // 超过50条文档时启用虚拟滚动
}) {
  // 如果文档数量少于阈值，或禁用虚拟化，则使用普通渲染
  if (!useVirtualization || documents.length < threshold) {
    return (
      <div className={viewMode === 'grid' ? 'dashboard-grid-view' : 'dashboard-list-view'}>
        {viewMode === 'grid' ? (
          documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              isSelected={selectedDocs.includes(doc.id)}
              onSelect={onSelectDoc}
              onDelete={onDeleteDoc}
              onExport={onExportDoc}
            />
          ))
        ) : (
          documents.map((doc) => (
            <DocumentListItem
              key={doc.id}
              doc={doc}
              isSelected={selectedDocs.includes(doc.id)}
              onSelect={onSelectDoc}
              onDelete={onDeleteDoc}
              onExport={onExportDoc}
            />
          ))
        )}
      </div>
    );
  }

  // 使用虚拟滚动
  return viewMode === 'grid' ? (
    <VirtualizedGridView
      documents={documents}
      selectedDocs={selectedDocs}
      onSelectDoc={onSelectDoc}
      onDeleteDoc={onDeleteDoc}
      onExportDoc={onExportDoc}
    />
  ) : (
    <VirtualizedListView
      documents={documents}
      selectedDocs={selectedDocs}
      onSelectDoc={onSelectDoc}
      onDeleteDoc={onDeleteDoc}
      onExportDoc={onExportDoc}
    />
  );
});

export default VirtualizedDocumentList;
